# MCP Tool Calling Feature

This document describes the new MCP (Model Context Protocol) tool calling feature added to Whispo.

## Overview

The MCP tool calling feature allows users to trigger external tools with their transcripts instead of just pasting the text into input fields. This enables powerful integrations with various MCP servers that can process, analyze, or act upon the transcribed text.

## Features

- **MCP Server Configuration**: JSON-based configuration for connecting to MCP servers
- **Tool Calling Button**: New button in the history interface to trigger MCP tools
- **Settings Interface**: UI for managing MCP servers and their configurations
- **Real-time Connection Status**: Visual indicators showing which servers are connected
- **Tool Selection Dialog**: Interactive dialog for selecting servers and tools

## Configuration

### MCP Servers

MCP servers are configured through the Settings > MCP page. Each server configuration includes:

- **Name**: Unique identifier for the server
- **Command**: The command to run the server (e.g., `node`, `python`, `npx`)
- **Arguments**: Command-line arguments for the server
- **Environment Variables**: Environment variables needed by the server
- **Enabled**: Whether the server should be automatically connected

### Example Configurations

#### Filesystem Server
```json
{
  "name": "filesystem",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  "env": {},
  "enabled": true
}
```

#### Brave Search Server
```json
{
  "name": "brave-search",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "your-api-key-here"
  },
  "enabled": true
}
```

#### Git Server
```json
{
  "name": "git",
  "command": "python",
  "args": ["-m", "mcp_server_git", "--repository", "."],
  "env": {},
  "enabled": true
}
```

## Usage

1. **Configure MCP Servers**: Go to Settings > MCP and add your desired MCP servers
2. **Enable Servers**: Toggle the switch to enable servers you want to use
3. **Record Audio**: Use Whispo normally to record and transcribe audio
4. **Call Tools**: Click the tool icon (🔧) next to any transcript in the history
5. **Select Server and Tool**: Choose which server and tool to use in the dialog
6. **View Results**: See the tool execution results in the dialog

## Available MCP Servers

Some popular MCP servers you can use:

- **@modelcontextprotocol/server-filesystem**: File system operations
- **@modelcontextprotocol/server-brave-search**: Web search capabilities
- **@modelcontextprotocol/server-git**: Git repository operations
- **@modelcontextprotocol/server-sqlite**: SQLite database operations
- **@modelcontextprotocol/server-github**: GitHub API operations

Visit [modelcontextprotocol.io](https://modelcontextprotocol.io) for more available servers.

## Testing

A test MCP server is included (`test-mcp-server.js`) with simple tools:

- **echo**: Echoes back the transcript with an optional prefix
- **word-count**: Counts words in the transcript
- **uppercase**: Converts transcript to uppercase

To test:

1. Run the test server: `node test-mcp-server.js`
2. Add it to your MCP configuration:
   ```json
   {
     "name": "test-server",
     "command": "node",
     "args": ["test-mcp-server.js"],
     "env": {},
     "enabled": true
   }
   ```

## Technical Implementation

### Architecture

- **Frontend**: React components for UI and settings management
- **Backend**: Node.js MCP client manager for server connections
- **IPC**: Electron IPC for communication between frontend and backend
- **Configuration**: JSON-based configuration stored in app data folder

### Key Components

- `src/main/mcp-client.ts`: MCP client manager and connection handling
- `src/renderer/src/pages/settings-mcp.tsx`: MCP settings interface
- `src/renderer/src/components/mcp-tool-button.tsx`: Tool calling button component
- `src/shared/types.ts`: TypeScript types for MCP functionality

### IPC Handlers

- `getMcpServers`: Get configured MCP servers
- `saveMcpServers`: Save MCP server configuration
- `getMcpConnectedServers`: Get list of connected servers
- `listMcpTools`: List available tools from a server
- `callMcpTool`: Execute a tool with transcript data
- `initializeMcpConnections`: Initialize connections on app start

## Security Considerations

- MCP servers run as separate processes with limited access
- Environment variables are stored in configuration but not exposed in UI
- Tool execution results are displayed but not automatically executed
- Server connections are managed and can be disabled at any time

## Future Enhancements

Potential future improvements:

- Tool argument customization in the UI
- Batch tool execution across multiple transcripts
- Tool execution history and logging
- Custom tool result formatting
- Integration with post-processing pipeline
- Keyboard shortcuts for quick tool access

## Troubleshooting

### Common Issues

1. **Server Not Connecting**: Check command and arguments are correct
2. **No Tools Available**: Ensure server is properly started and connected
3. **Tool Execution Fails**: Check server logs and environment variables
4. **Permission Errors**: Ensure proper file system permissions for server commands

### Debug Information

- Server connection status is shown in the MCP settings page
- Tool execution results include error messages
- Console logs provide detailed connection and execution information
