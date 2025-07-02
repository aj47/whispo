#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create a simple test MCP server
const server = new McpServer({
  name: "test-server",
  version: "1.0.0"
});

// Add a simple echo tool
server.registerTool(
  "echo",
  {
    title: "Echo Tool",
    description: "Echoes back the provided transcript with a prefix",
    inputSchema: {
      transcript: z.string().describe("The transcript to echo"),
      prefix: z.string().optional().describe("Optional prefix to add")
    }
  },
  async ({ transcript, prefix = "Echo:" }) => ({
    content: [{ 
      type: "text", 
      text: `${prefix} ${transcript}` 
    }]
  })
);

// Add a word count tool
server.registerTool(
  "word-count",
  {
    title: "Word Count",
    description: "Counts words in the transcript",
    inputSchema: {
      transcript: z.string().describe("The transcript to count words in")
    }
  },
  async ({ transcript }) => {
    const wordCount = transcript.trim().split(/\s+/).length;
    return {
      content: [{ 
        type: "text", 
        text: `Word count: ${wordCount}` 
      }]
    };
  }
);

// Add a simple uppercase tool
server.registerTool(
  "uppercase",
  {
    title: "Uppercase",
    description: "Converts transcript to uppercase",
    inputSchema: {
      transcript: z.string().describe("The transcript to convert")
    }
  },
  async ({ transcript }) => ({
    content: [{ 
      type: "text", 
      text: transcript.toUpperCase() 
    }]
  })
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Test MCP server started");
