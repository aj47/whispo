# MCP Tool Calling Integration

This document describes the MCP (Model Context Protocol) tool calling feature added to Whispo.

## Overview

The MCP tool calling feature allows Whispo to process transcribed text through external MCP servers instead of just pasting it directly. This enables powerful text processing workflows using various tools and services.

## Features

- **Configurable MCP Servers**: Connect to multiple MCP servers through JSON configuration
- **Tool Discovery**: Automatically discover and list available tools from connected servers
- **Smart Processing**: Process transcripts through MCP tools with intelligent tool selection
- **UI Integration**: New button in recording history to trigger MCP tool processing
- **Settings Management**: Dedicated settings page for MCP configuration

## Configuration

### 1. Enable MCP Tool Calling

1. Go to Settings → MCP Tools
2. Toggle "Enable MCP Tool Calling" to ON
3. Optionally set a custom shortcut key
4. Configure the path to your MCP servers configuration file

### 2. MCP Servers Configuration

Create a JSON file with your MCP server configurations:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"],
      "env": {}
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key-here"
      }
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "/path/to/database.db"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

### 3. Server Management

- Use the "Connect" button to connect to all configured servers
- Use the "Disconnect" button to disconnect from all servers
- View connected servers and available tools in the settings page

## Usage

### Processing Transcripts

1. Record audio as usual using Ctrl key
2. In the recording history, you'll see a new tool icon button (🔧) next to each transcript
3. Click the tool button to process the transcript through MCP tools
4. The processed result will be copied to your clipboard

### Available MCP Servers

The following official MCP servers are supported:

- **Filesystem**: File operations and content reading
- **Brave Search**: Web search capabilities
- **SQLite**: Database queries and operations
- **GitHub**: Repository and issue management
- **And many more**: See [MCP Servers](https://github.com/modelcontextprotocol/servers) for the full list

## Technical Details

### Architecture

- **MCP Client Manager**: Handles connections to multiple MCP servers
- **Tool Discovery**: Automatically lists available tools from connected servers
- **Smart Processing**: Attempts to find relevant tools for text processing
- **Error Handling**: Graceful fallback when tools fail or are unavailable

### Configuration Types

```typescript
export type McpServerConfig = {
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export type McpServersConfig = {
  mcpServers: Record<string, McpServerConfig>
}
```

### IPC Methods

- `connectToMcpServers()`: Connect to all configured servers
- `disconnectFromMcpServers()`: Disconnect from all servers
- `getMcpServers()`: Get list of connected servers
- `getMcpTools()`: Get available tools from all servers
- `callMcpTool(serverName, toolName, arguments)`: Call a specific tool
- `processTranscriptWithMcp(transcript)`: Process text through available tools

## Troubleshooting

### Common Issues

1. **Servers not connecting**: Check that the command and arguments are correct
2. **Tools not available**: Ensure servers are properly connected
3. **Processing fails**: Check server logs and ensure tools accept text input

### Debug Information

- Check the console for connection and tool execution logs
- Use the settings page to verify server status
- Test individual tools through the MCP settings interface

## Examples

### Text Enhancement Server

Create a custom MCP server that enhances text:

```javascript
// enhance-text-server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "text-enhancer",
  version: "1.0.0"
});

server.registerTool("enhance_text", {
  description: "Enhance and improve text quality",
  inputSchema: { text: z.string() }
}, async ({ text }) => ({
  content: [{ 
    type: "text", 
    text: `Enhanced: ${text.toUpperCase()}` 
  }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

Then configure it in your MCP servers JSON:

```json
{
  "mcpServers": {
    "text-enhancer": {
      "command": "node",
      "args": ["path/to/enhance-text-server.js"]
    }
  }
}
```

## Future Enhancements

- **LLM Integration**: Use LLMs to intelligently select which tools to call
- **Tool Chaining**: Chain multiple tools together for complex workflows
- **Custom Tool Parameters**: UI for configuring tool parameters
- **Tool Templates**: Pre-configured tool workflows for common tasks
- **Real-time Processing**: Process text as it's being transcribed
