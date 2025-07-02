#!/usr/bin/env node

/**
 * Elegant MCP Tool Selection Debugging Script
 *
 * This script helps debug and test the MCP tool selection functionality
 * by simulating various transcript inputs and analyzing the results.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test cases for different types of transcript content
const TEST_CASES = [
  // User speech that should trigger tools
  {
    name: "Audio transcription request",
    transcript: "Please transcribe the audio file at /Users/test/audio.wav",
    expectedShouldUseTool: true,
    expectedTools: ["transcribe_audio"]
  },
  {
    name: "Text to speech request",
    transcript: "Convert this text to speech and save it to my desktop",
    expectedShouldUseTool: true,
    expectedTools: ["text_to_speech"]
  },
  {
    name: "Model information request",
    transcript: "What speech to text models are available?",
    expectedShouldUseTool: true,
    expectedTools: ["list_stt_models"]
  },

  // User speech that should NOT trigger tools
  {
    name: "Casual conversation",
    transcript: "Hey how are you doing today?",
    expectedShouldUseTool: false,
    expectedTools: []
  },
  {
    name: "General question",
    transcript: "What's the weather like?",
    expectedShouldUseTool: false,
    expectedTools: []
  },

  // System logs that should be filtered out
  {
    name: "System log with emoji",
    transcript: "🔄 Release ctrl { isHoldingCtrlKey: false }",
    expectedShouldUseTool: false,
    expectedTools: [],
    shouldBeFiltered: true
  },
  {
    name: "MCP system message",
    transcript: "Connected MCP servers: [ 'groq' ]",
    expectedShouldUseTool: false,
    expectedTools: [],
    shouldBeFiltered: true
  },
  {
    name: "Date stamped log",
    transcript: "[07/02/25 15:07:03] INFO Processing request",
    expectedShouldUseTool: false,
    expectedTools: [],
    shouldBeFiltered: true
  },
  {
    name: "UUID log",
    transcript: "UUID:7DRmjWYhW5Q3nMs36HFieM NAME:Add debugging",
    expectedShouldUseTool: false,
    expectedTools: [],
    shouldBeFiltered: true
  },
  {
    name: "Technical fragment",
    transcript: "cked and dev update config is not forced",
    expectedShouldUseTool: false,
    expectedTools: [],
    shouldBeFiltered: true
  }
];

// Mock available tools (based on Groq MCP server)
const MOCK_AVAILABLE_TOOLS = [
  {
    serverName: "groq",
    name: "text_to_speech",
    description: "Convert text to speech using Groq's TTS model",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to convert to speech" },
        output_dir: { type: "string", description: "Output directory" }
      },
      required: ["text"]
    }
  },
  {
    serverName: "groq",
    name: "transcribe_audio",
    description: "Transcribe speech from an audio file",
    inputSchema: {
      type: "object",
      properties: {
        input_file_path: { type: "string", description: "Path to audio file" },
        output_dir: { type: "string", description: "Output directory" }
      },
      required: ["input_file_path"]
    }
  },
  {
    serverName: "groq",
    name: "list_stt_models",
    description: "List all available models for Groq's STT service",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    serverName: "groq",
    name: "chat_completion",
    description: "Generate a chat completion using Groq's API",
    inputSchema: {
      type: "object",
      properties: {
        messages: { type: "array", description: "Chat messages" },
        model: { type: "string", description: "Model to use" }
      },
      required: ["messages"]
    }
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Import the filtering function (simplified version for testing)
function isLikelyUserSpeech(transcript) {
  const text = transcript.trim().toLowerCase();

  if (text.length < 3) return { isUserSpeech: false, reason: "Too short" };

  const systemPatterns = [
    { pattern: /^\d{4}-\d{2}-\d{2}/, reason: "Date stamp" },
    { pattern: /^\[\d{2}\/\d{2}\/\d{2}/, reason: "Bracketed date" },
    { pattern: /^🔄|^🚀|^🎯|^📋|^🔧|^✅|^❌|^⚠️/, reason: "System emoji" },
    { pattern: /release ctrl|holding.*key|mcp.*server|connected/i, reason: "System message" },
    { pattern: /uuid:|task.*id:/i, reason: "Task management" }
  ];

  for (const { pattern, reason } of systemPatterns) {
    if (pattern.test(text)) {
      return { isUserSpeech: false, reason };
    }
  }

  return { isUserSpeech: true };
}

function runFilteringTests() {
  console.log(colorize('\n=== FILTERING TESTS ===', 'cyan'));

  let passed = 0;
  let total = 0;

  for (const testCase of TEST_CASES) {
    total++;
    const result = isLikelyUserSpeech(testCase.transcript);
    const shouldBeFiltered = testCase.shouldBeFiltered || false;
    const expectedFiltered = !result.isUserSpeech;

    const success = expectedFiltered === shouldBeFiltered;
    if (success) passed++;

    const status = success ? colorize('✓ PASS', 'green') : colorize('✗ FAIL', 'red');
    console.log(`${status} ${testCase.name}`);
    console.log(`  Input: "${testCase.transcript.slice(0, 60)}${testCase.transcript.length > 60 ? '...' : ''}"`);
    console.log(`  Expected filtered: ${shouldBeFiltered}, Got filtered: ${expectedFiltered}`);
    if (result.reason) {
      console.log(`  Filter reason: ${result.reason}`);
    }
    console.log('');
  }

  console.log(colorize(`Filtering Tests: ${passed}/${total} passed`, passed === total ? 'green' : 'red'));
}

function generateTestReport() {
  console.log(colorize('\n=== MCP TOOL SELECTION DEBUG REPORT ===', 'bright'));
  console.log(`Generated at: ${new Date().toISOString()}`);
  console.log(`Total test cases: ${TEST_CASES.length}`);
  console.log(`Available tools: ${MOCK_AVAILABLE_TOOLS.length}`);

  runFilteringTests();

  console.log(colorize('\n=== RECOMMENDATIONS ===', 'yellow'));
  console.log('1. Test with actual LLM providers to validate tool selection logic');
  console.log('2. Monitor logs in production to identify new system message patterns');
  console.log('3. Add more test cases based on real user speech patterns');
  console.log('4. Consider adding fuzzy matching for tool names in user speech');

  console.log(colorize('\n=== USAGE ===', 'blue'));
  console.log('Run this script to test MCP tool selection filtering and logic:');
  console.log('  node debug-mcp-tool-selection.js');
  console.log('');
  console.log('To test with custom transcript:');
  console.log('  node debug-mcp-tool-selection.js "your transcript here"');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const customTranscript = process.argv[2];

  if (customTranscript) {
    console.log(colorize('=== CUSTOM TRANSCRIPT TEST ===', 'cyan'));
    const result = isLikelyUserSpeech(customTranscript);
    console.log(`Input: "${customTranscript}"`);
    console.log(`Is user speech: ${result.isUserSpeech}`);
    if (result.reason) {
      console.log(`Reason: ${result.reason}`);
    }
  } else {
    generateTestReport();
  }
}

export {
  TEST_CASES,
  MOCK_AVAILABLE_TOOLS,
  isLikelyUserSpeech,
  runFilteringTests
};
