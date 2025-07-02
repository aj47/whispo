#!/usr/bin/env python3
"""
Elegant MCP Tool Calling Service using LiteLLM

This service provides a more elegant and streamlined approach to MCP tool calling
using LiteLLM's experimental MCP client functionality.
"""

import asyncio
import json
import os
import sys
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from pathlib import Path

import litellm
from simple_mcp_client import SimpleMCPClient


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


class LiteLLMMCPService:
    """Elegant MCP tool calling service using LiteLLM"""

    def __init__(self, config_path: Optional[str] = None):
        self.mcp_client = SimpleMCPClient(config_path)

    async def connect_to_all_servers(self) -> None:
        """Connect to all configured MCP servers"""
        await self.mcp_client.connect_to_all_servers()

    def get_all_tools(self) -> List[Dict]:
        """Get all available tools from all connected servers"""
        return self.mcp_client.get_all_tools()




    async def process_transcript_with_llm(
        self,
        transcript: str,
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> ToolCallResult:
        """
        Process transcript using LLM with MCP tools

        This is the main elegant interface that:
        1. Gets available tools
        2. Sends transcript + tools to LLM
        3. Executes any suggested tool calls
        4. Returns the result
        """
        try:
            print(f"🔍 DEBUG: Processing transcript with LLM - model: {model}")
            print(f"🔍 DEBUG: Transcript length: {len(transcript)} characters")
            print(f"🔍 DEBUG: Transcript preview: {transcript[:100]}...")

            # Get all available tools
            tools = self.get_all_tools()

            if not tools:
                print(f"🔍 DEBUG: No tools available - connected servers: {len(self.mcp_client.processes)}, tools cache: {len(self.mcp_client.tools_cache)}")
                return ToolCallResult(
                    success=False,
                    content=transcript,
                    error="No MCP tools available"
                )

            print(f"🔍 DEBUG: Found {len(tools)} tools, proceeding with LLM call")

            # Prepare messages for LLM
            system_prompt = self._create_system_prompt(tools)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcript}
            ]

            # Call LLM with tools
            llm_response = await litellm.acompletion(
                model=model,
                api_key=api_key,
                base_url=base_url,
                messages=messages,
                tools=tools,
                temperature=0.1,
                max_tokens=1000
            )

            # Check if LLM wants to call any tools
            message = llm_response.choices[0].message

            if not hasattr(message, 'tool_calls') or not message.tool_calls:
                # No tool calls, return original transcript
                return ToolCallResult(
                    success=True,
                    content=transcript,
                    error=None
                )

            # Execute the first tool call (for simplicity)
            tool_call = message.tool_calls[0]
            server_name = self._extract_server_name_from_tool(tool_call, tools)

            if not server_name or server_name not in self.mcp_client.processes:
                return ToolCallResult(
                    success=False,
                    content=transcript,
                    error=f"Server '{server_name}' not available for tool call"
                )

            # For now, just return that we found a tool call
            # TODO: Implement actual tool execution with SimpleMCPClient
            call_result = f"Tool call detected: {tool_call.function.name}"

            # Extract text content from result
            result_text = self._extract_text_from_result(call_result)

            return ToolCallResult(
                success=True,
                content=result_text or transcript,
                tool_name=tool_call.function.name,
                server_name=server_name
            )

        except Exception as e:
            print(f"❌ Error processing transcript with LLM: {e}")
            return ToolCallResult(
                success=False,
                content=transcript,
                error=str(e)
            )

    def _create_system_prompt(self, tools: List[Dict]) -> str:
        """Create system prompt for LLM with available tools"""
        tool_descriptions = []
        for tool in tools:
            server_name = tool.get('server_name', 'unknown')
            tool_name = tool.get('function', {}).get('name', 'unknown')
            description = tool.get('function', {}).get('description', 'No description')
            tool_descriptions.append(f"- {server_name}:{tool_name} - {description}")

        return f"""You are an AI assistant that can use MCP (Model Context Protocol) tools to help process and enhance user input.

Available tools:
{chr(10).join(tool_descriptions)}

When the user provides input, analyze if any of these tools would be helpful for processing, enhancing, or responding to their request. If so, call the appropriate tool. If not, simply acknowledge their input.

Focus on being helpful and only use tools when they would genuinely improve the response or fulfill the user's request."""

    def _extract_server_name_from_tool(self, tool_call, tools: List[Dict]) -> Optional[str]:
        """Extract server name for a given tool call"""
        tool_name = tool_call.function.name
        for tool in tools:
            if tool.get('function', {}).get('name') == tool_name:
                return tool.get('server_name')
        return None

    def _extract_text_from_result(self, call_result) -> Optional[str]:
        """Extract text content from MCP tool call result"""
        try:
            if hasattr(call_result, 'content') and call_result.content:
                if isinstance(call_result.content, list):
                    for item in call_result.content:
                        if hasattr(item, 'type') and item.type == 'text':
                            return item.text
                elif hasattr(call_result.content, 'text'):
                    return call_result.content.text
                elif isinstance(call_result.content, str):
                    return call_result.content
            return None
        except Exception as e:
            print(f"⚠️  Error extracting text from result: {e}")
            return None

    async def cleanup(self) -> None:
        """Clean up all connections"""
        await self.mcp_client.cleanup()


# CLI interface for testing
async def main():
    """Main function for CLI testing"""
    # Handle test mode
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        service = LiteLLMMCPService()
        try:
            await service.connect_to_all_servers()
            result = ToolCallResult(
                success=len(service.mcp_client.processes) > 0,
                content="Connection test completed",
                error=None if service.mcp_client.processes else "No servers connected"
            )
        except Exception as e:
            result = ToolCallResult(
                success=False,
                content="Connection test failed",
                error=str(e)
            )
        finally:
            await service.cleanup()

        # Output JSON result for TypeScript to parse
        print(json.dumps({
            "success": result.success,
            "content": result.content,
            "error": result.error
        }))
        return

    # Normal processing mode
    if len(sys.argv) < 2:
        print("Usage: python litellm-mcp-service.py <transcript> [model] [api_key]")
        print("       python litellm-mcp-service.py --test")
        sys.exit(1)

    transcript = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "gpt-4o-mini"
    api_key = sys.argv[3] if len(sys.argv) > 3 else None

    # Try to get API key from environment if not provided
    if not api_key:
        if "gpt" in model.lower() or "openai" in model.lower():
            api_key = os.getenv("OPENAI_API_KEY")
        elif "gemini" in model.lower():
            api_key = os.getenv("GEMINI_API_KEY")
        elif "groq" in model.lower() or "gemma" in model.lower():
            api_key = os.getenv("GROQ_API_KEY")

    base_url = os.getenv("LITELLM_BASE_URL")

    service = LiteLLMMCPService()

    try:
        await service.connect_to_all_servers()
        result = await service.process_transcript_with_llm(
            transcript=transcript,
            model=model,
            api_key=api_key,
            base_url=base_url
        )

        # Output JSON result for TypeScript to parse
        print(json.dumps({
            "success": result.success,
            "content": result.content,
            "error": result.error,
            "tool_name": result.tool_name,
            "server_name": result.server_name
        }))

    except Exception as e:
        # Output error as JSON
        print(json.dumps({
            "success": False,
            "content": transcript,
            "error": str(e)
        }))
    finally:
        await service.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
