import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { configStore } from "./config"
import { McpServerConfig, McpServersConfig } from "@shared/types"
import fs from "fs"
import path from "path"
import { app } from "electron"
import { selectToolsWithLLM, AvailableTool } from "./mcp-tool-selection"
import { processTranscriptWithLiteLLM } from "./litellm-mcp-client"

export class McpClientManager {
  private clients: Map<string, Client> = new Map()
  private transports: Map<string, StdioClientTransport> = new Map()

  async loadServersConfig(): Promise<McpServersConfig | null> {
    const config = configStore.get()
    const configPath = config.mcpServersConfigPath

    if (!configPath) {
      // Try default path
      const defaultPath = path.join(app.getPath("appData"), process.env.APP_ID, "mcp-servers.json")
      if (fs.existsSync(defaultPath)) {
        try {
          const content = fs.readFileSync(defaultPath, "utf8")
          return JSON.parse(content) as McpServersConfig
        } catch (error) {
          console.error("Failed to load default MCP servers config:", error)
          return null
        }
      }
      return null
    }

    try {
      if (!fs.existsSync(configPath)) {
        console.warn(`MCP servers config file not found: ${configPath}`)
        return null
      }

      const content = fs.readFileSync(configPath, "utf8")
      return JSON.parse(content) as McpServersConfig
    } catch (error) {
      console.error("Failed to load MCP servers config:", error)
      return null
    }
  }

  async connectToServer(serverName: string, serverConfig: McpServerConfig): Promise<void> {
    try {
      // Disconnect existing client if any
      await this.disconnectFromServer(serverName)

      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env,
        cwd: serverConfig.cwd,
      })

      const client = new Client(
        {
          name: "whispo-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      )

      await client.connect(transport)

      this.clients.set(serverName, client)
      this.transports.set(serverName, transport)

      console.log(`Connected to MCP server: ${serverName}`)
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverName}:`, error)
      throw error
    }
  }

  async disconnectFromServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName)
    const transport = this.transports.get(serverName)

    if (client) {
      try {
        await client.close()
      } catch (error) {
        console.error(`Error closing MCP client ${serverName}:`, error)
      }
      this.clients.delete(serverName)
    }

    if (transport) {
      try {
        await transport.close()
      } catch (error) {
        console.error(`Error closing MCP transport ${serverName}:`, error)
      }
      this.transports.delete(serverName)
    }
  }

  async connectToAllServers(): Promise<void> {
    const serversConfig = await this.loadServersConfig()
    if (!serversConfig) {
      console.log("No MCP servers configuration found")
      return
    }

    const connectionPromises = Object.entries(serversConfig.mcpServers).map(
      async ([serverName, serverConfig]) => {
        try {
          await this.connectToServer(serverName, serverConfig)
        } catch (error) {
          console.error(`Failed to connect to server ${serverName}:`, error)
        }
      }
    )

    await Promise.allSettled(connectionPromises)
  }

  async disconnectFromAllServers(): Promise<void> {
    const disconnectionPromises = Array.from(this.clients.keys()).map(
      (serverName) => this.disconnectFromServer(serverName)
    )

    await Promise.allSettled(disconnectionPromises)
  }

  async listAvailableTools(): Promise<Array<{ serverName: string; tools: any[] }>> {
    const results: Array<{ serverName: string; tools: any[] }> = []

    for (const [serverName, client] of this.clients.entries()) {
      try {
        const response = await client.listTools()
        results.push({
          serverName,
          tools: response.tools || [],
        })
      } catch (error) {
        console.error(`Failed to list tools for server ${serverName}:`, error)
        results.push({
          serverName,
          tools: [],
        })
      }
    }

    return results
  }

  async callTool(serverName: string, toolName: string, arguments_: Record<string, any>): Promise<any> {
    const client = this.clients.get(serverName)
    if (!client) {
      throw new Error(`No client connected for server: ${serverName}`)
    }

    try {
      const response = await client.callTool({
        name: toolName,
        arguments: arguments_,
      })

      return response
    } catch (error) {
      console.error(`Failed to call tool ${toolName} on server ${serverName}:`, error)
      throw error
    }
  }

  async processTranscriptWithTools(transcript: string): Promise<string> {
    const config = configStore.get()

    // Check if elegant LiteLLM MCP tool calling is enabled
    const useLiteLLMToolCalling = config.mcpUseLiteLLM !== false // Default to true for elegant approach

    if (useLiteLLMToolCalling) {
      console.log("🚀 Using elegant LiteLLM MCP tool calling")
      return processTranscriptWithLiteLLM(transcript)
    }

    // Fallback to legacy approaches
    const useLLMToolSelection = config.mcpLLMToolSelectionEnabled !== false // Default to true

    if (useLLMToolSelection) {
      console.log("📋 Using legacy LLM tool selection")
      return this.processTranscriptWithLLMSelection(transcript)
    } else {
      console.log("🔍 Using legacy heuristic tool selection")
      return this.processTranscriptWithHeuristics(transcript)
    }
  }

  private async processTranscriptWithLLMSelection(transcript: string): Promise<string> {
    try {
      const availableToolsData = await this.listAvailableTools()

      if (availableToolsData.length === 0) {
        console.log("No MCP tools available")
        return transcript
      }

      // Convert to the format expected by the LLM tool selection
      const availableTools: AvailableTool[] = []
      for (const { serverName, tools } of availableToolsData) {
        for (const tool of tools) {
          availableTools.push({
            serverName,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          })
        }
      }

      // Use LLM to select appropriate tools
      const toolSelection = await selectToolsWithLLM(transcript, availableTools)

      console.log("LLM tool selection result:", toolSelection)

      if (!toolSelection.shouldUseTool || toolSelection.selectedTools.length === 0) {
        console.log("LLM determined no tools should be used:", toolSelection.reasoning)
        return transcript
      }

      // Execute selected tools in priority order
      const sortedTools = toolSelection.selectedTools.sort((a, b) => a.priority - b.priority)
      let processedTranscript = transcript

      for (const selectedTool of sortedTools) {
        try {
          console.log(`Calling tool ${selectedTool.toolName} on server ${selectedTool.serverName}`)
          const result = await this.callTool(
            selectedTool.serverName,
            selectedTool.toolName,
            selectedTool.arguments
          )

          // Extract text from the result
          if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find((item: any) => item.type === 'text')
            if (textContent) {
              processedTranscript = textContent.text
              console.log(`Tool ${selectedTool.toolName} processed transcript successfully`)
              // For now, we'll use the result from the first successful tool
              // In the future, we might chain tools or combine results
              break
            }
          }
        } catch (error) {
          console.error(`Failed to call tool ${selectedTool.toolName}:`, error)
          // Continue with next tool
        }
      }

      return processedTranscript
    } catch (error) {
      console.error("LLM tool selection failed, falling back to heuristics:", error)
      return this.processTranscriptWithHeuristics(transcript)
    }
  }

  private async processTranscriptWithHeuristics(transcript: string): Promise<string> {
    const availableTools = await this.listAvailableTools()

    if (availableTools.length === 0) {
      console.log("No MCP tools available")
      return transcript
    }

    // Look for a "process_text" or "enhance_text" tool (original heuristic approach)
    for (const { serverName, tools } of availableTools) {
      const processTextTool = tools.find(tool =>
        tool.name.toLowerCase().includes('process') ||
        tool.name.toLowerCase().includes('enhance') ||
        tool.name.toLowerCase().includes('text')
      )

      if (processTextTool) {
        try {
          const result = await this.callTool(serverName, processTextTool.name, { text: transcript })

          // Extract text from the result
          if (result.content && Array.isArray(result.content)) {
            const textContent = result.content.find((item: any) => item.type === 'text')
            if (textContent) {
              return textContent.text
            }
          }
        } catch (error) {
          console.error(`Failed to process transcript with tool ${processTextTool.name}:`, error)
        }
      }
    }

    // If no suitable tool found or all failed, return original transcript
    return transcript
  }

  getConnectedServers(): string[] {
    return Array.from(this.clients.keys())
  }

  isServerConnected(serverName: string): boolean {
    return this.clients.has(serverName)
  }
}

// Global instance
export const mcpClientManager = new McpClientManager()
