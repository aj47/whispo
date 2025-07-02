#!/usr/bin/env python3
"""
Simple MCP Client that works directly with subprocess communication
Bypasses the problematic mcp.client.stdio library
"""

import asyncio
import json
import os
import sys
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from pathlib import Path


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server"""
    name: str
    command: str
    args: List[str]
    env: Optional[Dict[str, str]] = None
    cwd: Optional[str] = None


@dataclass
class ToolCallResult:
    """Result of a tool call"""
    success: bool
    content: str
    error: Optional[str] = None
    tool_name: Optional[str] = None
    server_name: Optional[str] = None


class SimpleMCPClient:
    """Simple MCP client using direct subprocess communication"""

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or self._get_default_config_path()
        self.servers: Dict[str, MCPServerConfig] = {}
        self.processes: Dict[str, asyncio.subprocess.Process] = {}
        self.tools_cache: Dict[str, List[Dict]] = {}
        self.request_id = 0

    def _get_default_config_path(self) -> str:
        """Get the default MCP servers configuration path"""
        project_root = Path(__file__).parent.parent.parent
        return str(project_root / "mcp-servers.json")

    def _next_request_id(self) -> int:
        """Get next request ID"""
        self.request_id += 1
        return self.request_id

    async def load_servers_config(self) -> None:
        """Load MCP servers configuration from JSON file"""
        print(f"🔍 DEBUG: Loading MCP servers config from: {self.config_path}")

        try:
            if not os.path.exists(self.config_path):
                print(f"⚠️  MCP config file not found: {self.config_path}")
                return

            with open(self.config_path, 'r') as f:
                config_data = json.load(f)

            if 'mcpServers' not in config_data:
                print("⚠️  No 'mcpServers' section found in config")
                return

            for server_name, server_config in config_data['mcpServers'].items():
                self.servers[server_name] = MCPServerConfig(
                    name=server_name,
                    command=server_config['command'],
                    args=server_config.get('args', []),
                    env=server_config.get('env'),
                    cwd=server_config.get('cwd')
                )

            print(f"✅ Loaded {len(self.servers)} MCP server configurations")

        except Exception as e:
            print(f"❌ Failed to load MCP servers config: {e}")

    async def connect_to_server(self, server_name: str) -> bool:
        """Connect to a specific MCP server"""
        print(f"🔍 DEBUG: Connecting to server '{server_name}'")

        if server_name not in self.servers:
            print(f"❌ Server '{server_name}' not found in configuration")
            return False

        server_config = self.servers[server_name]

        try:
            # Prepare environment variables
            env_vars = os.environ.copy()
            if server_config.env:
                env_vars.update(server_config.env)

            # Prepare working directory
            cwd = None
            if server_config.cwd:
                project_root = Path(self.config_path).parent
                cwd = str(project_root / server_config.cwd)

            # Start the server process
            process = await asyncio.create_subprocess_exec(
                server_config.command,
                *server_config.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env_vars,
                cwd=cwd
            )

            print(f"🔍 DEBUG: Server process started with PID: {process.pid}")

            # Send initialization message
            init_message = {
                "jsonrpc": "2.0",
                "id": self._next_request_id(),
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "experimental": {},
                        "sampling": {}
                    },
                    "clientInfo": {
                        "name": "simple-mcp-client",
                        "version": "1.0.0"
                    }
                }
            }

            # Send init message
            init_json = json.dumps(init_message) + "\n"
            process.stdin.write(init_json.encode())
            await process.stdin.drain()

            # Wait for init response
            response_data = await asyncio.wait_for(
                process.stdout.readline(),
                timeout=5.0
            )

            if not response_data:
                print(f"❌ No initialization response from {server_name}")
                return False

            response_text = response_data.decode().strip()
            response_json = json.loads(response_text)

            if "result" not in response_json:
                print(f"❌ Initialization failed for {server_name}: {response_json}")
                return False

            print(f"✅ Initialization successful for {server_name}")

            # Send initialized notification
            initialized_message = {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            }

            init_notif_json = json.dumps(initialized_message) + "\n"
            process.stdin.write(init_notif_json.encode())
            await process.stdin.drain()

            # Store the process
            self.processes[server_name] = process

            # Load tools
            await self._load_tools(server_name)

            return True

        except Exception as e:
            print(f"❌ Failed to connect to server '{server_name}': {e}")
            return False

    async def _load_tools(self, server_name: str) -> None:
        """Load tools from a server"""
        try:
            process = self.processes[server_name]

            # Send tools/list request
            tools_message = {
                "jsonrpc": "2.0",
                "id": self._next_request_id(),
                "method": "tools/list"
            }

            tools_json = json.dumps(tools_message) + "\n"
            process.stdin.write(tools_json.encode())
            await process.stdin.drain()

            # Wait for tools response
            response_data = await asyncio.wait_for(
                process.stdout.readline(),
                timeout=5.0
            )

            if response_data:
                response_text = response_data.decode().strip()
                response_json = json.loads(response_text)

                if "result" in response_json and "tools" in response_json["result"]:
                    tools_list = response_json["result"]["tools"]
                    
                    # Convert to OpenAI format
                    openai_tools = []
                    for tool in tools_list:
                        openai_tools.append({
                            "type": "function",
                            "function": {
                                "name": tool["name"],
                                "description": tool.get("description", ""),
                                "parameters": tool.get("inputSchema", {})
                            }
                        })
                    
                    self.tools_cache[server_name] = openai_tools
                    print(f"✅ Loaded {len(tools_list)} tools from {server_name}")
                else:
                    print(f"❌ Unexpected tools response from {server_name}")
                    self.tools_cache[server_name] = []
            else:
                print(f"❌ No tools response from {server_name}")
                self.tools_cache[server_name] = []

        except Exception as e:
            print(f"❌ Failed to load tools from {server_name}: {e}")
            self.tools_cache[server_name] = []

    async def connect_to_all_servers(self) -> None:
        """Connect to all configured MCP servers"""
        await self.load_servers_config()

        if not self.servers:
            return

        connection_tasks = [
            self.connect_to_server(server_name)
            for server_name in self.servers.keys()
        ]

        results = await asyncio.gather(*connection_tasks, return_exceptions=True)
        
        successful_connections = sum(1 for result in results if result is True)
        print(f"🔗 Connected to {successful_connections}/{len(self.servers)} MCP servers")

    def get_all_tools(self) -> List[Dict]:
        """Get all available tools from all connected servers"""
        all_tools = []
        for server_name, tools in self.tools_cache.items():
            all_tools.extend(tools)
        return all_tools

    async def cleanup(self):
        """Clean up all server processes"""
        for server_name, process in self.processes.items():
            if process.returncode is None:
                process.terminate()
                await process.wait()


# Test function
async def test_simple_client():
    """Test the simple MCP client"""
    client = SimpleMCPClient()
    
    try:
        await client.connect_to_all_servers()
        
        tools = client.get_all_tools()
        print(f"🔍 DEBUG: Total tools available: {len(tools)}")
        
        for i, tool in enumerate(tools):
            tool_name = tool.get('function', {}).get('name', 'unknown')
            print(f"  {i+1}. {tool_name}")
            
        return {"success": True, "tools_count": len(tools)}
        
    finally:
        await client.cleanup()


if __name__ == "__main__":
    result = asyncio.run(test_simple_client())
    print(json.dumps(result, indent=2))
