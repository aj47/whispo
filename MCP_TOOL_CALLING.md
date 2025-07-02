# MCP Tool Calling Feature

This document describes the new MCP (Model Context Protocol) tool calling feature in Whispo.

## Overview

The MCP tool calling feature allows you to integrate external MCP servers and call their tools directly from Whispo, instead of just pasting transcribed text. This enables powerful workflows where you can:

- Search the web using Brave Search
- Interact with file systems
- Query databases
- Manage GitHub repositories
- And much more through any MCP-compatible server

## Setup

### 1. Enable MCP Tool Calling

1. Open Whispo settings
2. Navigate to "MCP Tools" tab
3. Enable "MCP Tool Calling"
4. Choose your preferred shortcut:
   - **Hold Alt**: Hold Alt key for 800ms to open tool calling modal
   - **Alt+/**: Press Alt+/ to open tool calling modal
   - **Ctrl+Shift**: Press Ctrl+Shift to open tool calling modal

### 2. Configure MCP Servers

1. Create a JSON configuration file for your MCP servers
2. Set the path to this file in the "MCP Servers Config Path" field
3. Click "Test" to verify the configuration

### Example Configuration File

Create a file named `mcp-servers-config.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "name": "File System Tools",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/Documents"],
      "description": "File system operations for Documents folder"
    },
    "brave-search": {
      "name": "Brave Search",
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key-here"
      },
      "description": "Web search capabilities using Brave Search API"
    },
    "memory": {
      "name": "Memory Storage",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "description": "Persistent memory storage for conversations"
    }
  }
}
```

## Usage

### Opening the Tool Calling Modal

Once configured, you can open the MCP tool calling modal using your chosen shortcut:

- **Hold Alt**: Hold the Alt key for about 800ms
- **Alt+/**: Press Alt and / keys simultaneously  
- **Ctrl+Shift**: Press Ctrl and Shift keys simultaneously

### Using Tools

1. The modal will show all available tools from your connected MCP servers
2. Select a tool from the dropdown
3. Fill in any required arguments
4. Click "Call Tool" to execute
5. View the results in the modal

### Tool Arguments

The modal automatically generates input fields based on the tool's schema:
- **String arguments**: Text input fields
- **Number arguments**: Number input fields  
- **Boolean arguments**: True/False dropdown
- **Complex arguments**: JSON input fields

## Available MCP Servers

Here are some popular MCP servers you can use:

### Official Servers

- **@modelcontextprotocol/server-filesystem**: File system operations
- **@modelcontextprotocol/server-brave-search**: Web search via Brave API
- **@modelcontextprotocol/server-sqlite**: SQLite database operations
- **@modelcontextprotocol/server-github**: GitHub repository management
- **@modelcontextprotocol/server-memory**: Persistent memory storage

### Installation

Most servers can be run directly with npx without installation:

```bash
npx -y @modelcontextprotocol/server-filesystem /path/to/directory
```

### API Keys

Some servers require API keys:
- **Brave Search**: Get API key from [Brave Search API](https://api.search.brave.com/)
- **GitHub**: Create a Personal Access Token in GitHub settings

## Troubleshooting

### Connection Issues

1. **Server not starting**: Check that the command and arguments are correct
2. **Permission errors**: Ensure the server has access to required resources
3. **API key errors**: Verify API keys are correctly set in the environment variables

### Tool Calling Issues

1. **No tools available**: Check that servers are properly connected in the settings
2. **Tool execution fails**: Verify the arguments match the expected schema
3. **Timeout errors**: Some tools may take longer to execute

### Debug Mode

Check the console logs in the main Whispo window for detailed error messages:
- On macOS: `Cmd+Option+I`
- On Windows/Linux: `Ctrl+Shift+I`

## Security Considerations

- MCP servers run as separate processes with their own permissions
- File system servers should be configured with appropriate directory restrictions
- API keys should be stored securely and not shared
- Only install MCP servers from trusted sources

## Examples

### Web Search Example

1. Configure Brave Search server with your API key
2. Use shortcut to open tool calling modal
3. Select "search" tool
4. Enter your search query
5. Get search results directly in the modal

### File Operations Example

1. Configure filesystem server with a specific directory
2. Use "read_file" tool to view file contents
3. Use "write_file" tool to create or modify files
4. Use "list_directory" tool to browse folders

## Contributing

To add support for new MCP servers or improve the tool calling interface:

1. Check the MCP specification at [modelcontextprotocol.io](https://modelcontextprotocol.io)
2. Test new servers with the configuration format
3. Submit issues or pull requests with improvements

## Related Links

- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)
