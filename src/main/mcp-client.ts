import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { McpServerConfig, McpToolCallResult } from "@shared/types"
import { configStore } from "./config"

class McpClientManager {
  private clients: Map<string, Client> = new Map()
  private transports: Map<string, StdioClientTransport> = new Map()

  async connectToServer(serverConfig: McpServerConfig): Promise<void> {
    if (this.clients.has(serverConfig.name)) {
      return // Already connected
    }

    try {
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      })

      const client = new Client(
        {
          name: "whispo-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      )

      await client.connect(transport)

      this.clients.set(serverConfig.name, client)
      this.transports.set(serverConfig.name, transport)

      console.log(`Connected to MCP server: ${serverConfig.name}`)
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverConfig.name}:`, error)
      throw error
    }
  }

  async disconnectFromServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName)
    const transport = this.transports.get(serverName)

    if (client) {
      await client.close()
      this.clients.delete(serverName)
    }

    if (transport) {
      await transport.close()
      this.transports.delete(serverName)
    }

    console.log(`Disconnected from MCP server: ${serverName}`)
  }

  async listAvailableTools(serverName: string): Promise<any[]> {
    const client = this.clients.get(serverName)
    if (!client) {
      throw new Error(`Not connected to server: ${serverName}`)
    }

    try {
      const response = await client.listTools()
      return response.tools || []
    } catch (error) {
      console.error(`Failed to list tools from ${serverName}:`, error)
      throw error
    }
  }

  async callTool(
    serverName: string,
    toolName: string,
    arguments_: Record<string, any>,
    transcript: string
  ): Promise<McpToolCallResult> {
    const client = this.clients.get(serverName)
    if (!client) {
      throw new Error(`Not connected to server: ${serverName}`)
    }

    try {
      // Add transcript to arguments if the tool expects it
      const toolArgs = {
        ...arguments_,
        transcript: transcript,
        text: transcript, // Some tools might expect 'text' instead
      }

      const response = await client.callTool({
        name: toolName,
        arguments: toolArgs,
      })

      // Extract text content from response
      let content = ""
      if (response.content && Array.isArray(response.content)) {
        for (const item of response.content) {
          if (item.type === "text") {
            content += item.text + "\n"
          }
        }
      }

      return {
        success: true,
        content: content.trim(),
      }
    } catch (error) {
      console.error(`Failed to call tool ${toolName} on ${serverName}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async initializeConnections(): Promise<void> {
    const config = configStore.get()
    const mcpServers = config.mcpServers || []

    for (const serverConfig of mcpServers) {
      if (serverConfig.enabled) {
        try {
          await this.connectToServer(serverConfig)
        } catch (error) {
          console.error(`Failed to initialize connection to ${serverConfig.name}:`, error)
        }
      }
    }
  }

  async refreshConnections(): Promise<void> {
    // Disconnect all existing connections
    const serverNames = Array.from(this.clients.keys())
    for (const serverName of serverNames) {
      await this.disconnectFromServer(serverName)
    }

    // Reconnect based on current config
    await this.initializeConnections()
  }

  getConnectedServers(): string[] {
    return Array.from(this.clients.keys())
  }

  isConnected(serverName: string): boolean {
    return this.clients.has(serverName)
  }

  async cleanup(): Promise<void> {
    const serverNames = Array.from(this.clients.keys())
    for (const serverName of serverNames) {
      await this.disconnectFromServer(serverName)
    }
  }
}

export const mcpClientManager = new McpClientManager()
