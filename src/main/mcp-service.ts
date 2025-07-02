import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import fs from "fs"
import path from "path"
import { McpServersConfig, McpTool, McpToolCallResult } from "../shared/types"

interface ConnectedServer {
  id: string
  name: string
  client: Client
  transport: StdioClientTransport
  tools: McpTool[]
}

export class McpService {
  private connectedServers: Map<string, ConnectedServer> = new Map()
  private isInitialized = false

  async initialize(configPath?: string): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (!configPath || !fs.existsSync(configPath)) {
      console.log("MCP config file not found, skipping MCP initialization")
      return
    }

    try {
      const configContent = fs.readFileSync(configPath, "utf8")
      const config: McpServersConfig = JSON.parse(configContent)

      for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
        try {
          await this.connectToServer(serverId, serverConfig)
        } catch (error) {
          console.error(`Failed to connect to MCP server ${serverId}:`, error)
        }
      }

      this.isInitialized = true
      console.log(`MCP Service initialized with ${this.connectedServers.size} servers`)
    } catch (error) {
      console.error("Failed to initialize MCP service:", error)
      throw error
    }
  }

  private async connectToServer(serverId: string, config: any): Promise<void> {
    const client = new Client({
      name: "whispo-mcp-client",
      version: "1.0.0"
    })

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: config.env
    })

    await client.connect(transport)

    // List available tools
    const toolsResponse = await client.listTools()
    const tools: McpTool[] = toolsResponse.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      serverId
    }))

    const connectedServer: ConnectedServer = {
      id: serverId,
      name: config.name || serverId,
      client,
      transport,
      tools
    }

    this.connectedServers.set(serverId, connectedServer)
    console.log(`Connected to MCP server ${serverId} with ${tools.length} tools`)
  }

  async getAllTools(): Promise<McpTool[]> {
    const allTools: McpTool[] = []
    for (const server of this.connectedServers.values()) {
      allTools.push(...server.tools)
    }
    return allTools
  }

  async callTool(toolName: string, serverId: string, arguments_: any): Promise<McpToolCallResult> {
    const server = this.connectedServers.get(serverId)
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`)
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: arguments_
      })

      return {
        content: (result.content as any[]).map((item: any) => {
          if (item.type === "text") {
            return {
              type: "text" as const,
              text: item.text
            }
          } else if (item.type === "image") {
            return {
              type: "image" as const,
              data: item.data,
              mimeType: item.mimeType
            }
          } else if (item.type === "resource") {
            return {
              type: "resource" as const,
              text: item.resource?.text,
              mimeType: item.resource?.mimeType
            }
          }
          return {
            type: "text" as const,
            text: JSON.stringify(item)
          }
        }),
        isError: Boolean(result.isError)
      }
    } catch (error) {
      console.error(`Error calling tool ${toolName} on server ${serverId}:`, error)
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      }
    }
  }

  async disconnect(): Promise<void> {
    for (const server of this.connectedServers.values()) {
      try {
        await server.client.close()
      } catch (error) {
        console.error(`Error disconnecting from server ${server.id}:`, error)
      }
    }
    this.connectedServers.clear()
    this.isInitialized = false
  }

  getConnectedServers(): Array<{ id: string; name: string; toolCount: number }> {
    return Array.from(this.connectedServers.values()).map(server => ({
      id: server.id,
      name: server.name,
      toolCount: server.tools.length
    }))
  }
}

export const mcpService = new McpService()
