import { GoogleGenerativeAI } from "@google/generative-ai"
import { configStore } from "./config"

// JSON Schema for structured tool selection output
export const TOOL_SELECTION_SCHEMA = {
  type: "object",
  properties: {
    reasoning: {
      type: "string",
      description: "Brief explanation of why these tools were selected or why no tools are needed"
    },
    shouldUseTool: {
      type: "boolean",
      description: "Whether any MCP tool should be used for this transcript"
    },
    selectedTools: {
      type: "array",
      items: {
        type: "object",
        properties: {
          serverName: {
            type: "string",
            description: "Name of the MCP server containing the tool"
          },
          toolName: {
            type: "string",
            description: "Name of the tool to call"
          },
          arguments: {
            type: "object",
            description: "Arguments to pass to the tool"
          },
          priority: {
            type: "number",
            description: "Priority order for tool execution (1 = highest priority)"
          }
        },
        required: ["serverName", "toolName", "arguments", "priority"]
      }
    }
  },
  required: ["reasoning", "shouldUseTool", "selectedTools"]
}

export interface ToolSelection {
  reasoning: string
  shouldUseTool: boolean
  selectedTools: Array<{
    serverName: string
    toolName: string
    arguments: Record<string, any>
    priority: number
  }>
}

export interface AvailableTool {
  serverName: string
  name: string
  description?: string
  inputSchema?: any
}

/**
 * Filter out system logs, debug output, and other non-user speech content
 */
function isLikelyUserSpeech(transcript: string): { isUserSpeech: boolean; reason?: string } {
  const text = transcript.trim().toLowerCase()

  // Empty or very short content
  if (text.length < 3) {
    return { isUserSpeech: false, reason: "Content too short (< 3 characters)" }
  }

  // System log patterns
  const systemLogPatterns = [
    { pattern: /^\d{4}-\d{2}-\d{2}/, reason: "Date stamp format" },
    { pattern: /^\[\d{2}\/\d{2}\/\d{2}/, reason: "Bracketed date format" },
    { pattern: /^(info|debug|error|warn|warning):/i, reason: "Log level prefix" },
    { pattern: /^🔄|^🚀|^🎯|^📋|^🔧|^✅|^❌|^⚠️/, reason: "System emoji prefix" },
    { pattern: /release ctrl|holding.*key|shortcut|processing|connected/i, reason: "System state message" },
    { pattern: /mcp.*server|config.*forced|clipboard.*content/i, reason: "MCP system message" },
    { pattern: /uuid:|task.*id:|created.*updated.*deleted/i, reason: "Task management log" },
  ]

  // Check if it matches system log patterns
  for (const { pattern, reason } of systemLogPatterns) {
    if (pattern.test(text)) {
      return { isUserSpeech: false, reason }
    }
  }

  // Very technical content that's unlikely to be user speech
  const technicalPatterns = [
    { pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/, reason: "UUID format" },
    { pattern: /^[a-z_]+\.[a-z_]+\(\)/, reason: "Function call format" },
    { pattern: /^(get|post|put|delete)\s+\/api/, reason: "API call format" },
    { pattern: /^\{.*\}$/, reason: "JSON object format" },
    { pattern: /^<[^>]+>/, reason: "XML/HTML tag format" },
  ]

  for (const { pattern, reason } of technicalPatterns) {
    if (pattern.test(text)) {
      return { isUserSpeech: false, reason }
    }
  }

  // Content that's too fragmented or incomplete
  const fragmentedPatterns = [
    { pattern: /^(and|or|but|the|a|an|is|are|was|were)$/i, reason: "Single common word" },
    { pattern: /^[.]{3,}/, reason: "Multiple dots" },
    { pattern: /^-{3,}/, reason: "Multiple dashes" },
    { pattern: /^\s*$/, reason: "Only whitespace" },
  ]

  for (const { pattern, reason } of fragmentedPatterns) {
    if (pattern.test(text)) {
      return { isUserSpeech: false, reason }
    }
  }

  return { isUserSpeech: true }
}

// Wrapper function to maintain backward compatibility
function isLikelyUserSpeechSimple(transcript: string): boolean {
  return isLikelyUserSpeech(transcript).isUserSpeech
}

/**
 * Use the post-processing LLM to intelligently select and configure MCP tools
 * based on the transcript and available tools
 */
export async function selectToolsWithLLM(
  transcript: string,
  availableTools: AvailableTool[]
): Promise<ToolSelection> {
  const config = configStore.get()

  // Filter out system logs and non-user speech
  const speechCheck = isLikelyUserSpeech(transcript)
  if (!speechCheck.isUserSpeech) {
    console.log("🚫 MCP Tool Selection: Filtered out non-user speech:", {
      transcript: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
      length: transcript.length,
      filterReason: speechCheck.reason
    })
    return {
      reasoning: `Content appears to be system logs or non-user speech: ${speechCheck.reason}`,
      shouldUseTool: false,
      selectedTools: []
    }
  }

  console.log("✅ MCP Tool Selection: Processing user speech:", {
    transcript: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
    length: transcript.length,
    availableToolsCount: availableTools.length
  })

  // If no tools available, return empty selection
  if (availableTools.length === 0) {
    return {
      reasoning: "No MCP tools are available",
      shouldUseTool: false,
      selectedTools: []
    }
  }

  // Create detailed tool descriptions with input schemas
  const toolsDescription = availableTools.map(tool => {
    let toolInfo = `**${tool.name}** (Server: ${tool.serverName})`

    if (tool.description) {
      toolInfo += `\n  Description: ${tool.description}`
    }

    if (tool.inputSchema && tool.inputSchema.properties) {
      toolInfo += `\n  Parameters:`
      const required = tool.inputSchema.required || []
      Object.entries(tool.inputSchema.properties).forEach(([param, schema]: [string, any]) => {
        const isRequired = required.includes(param)
        const paramType = schema.type || 'any'
        const paramDesc = schema.description || 'No description'
        toolInfo += `\n    - ${param} (${paramType}${isRequired ? ', required' : ', optional'}): ${paramDesc}`
      })
    }

    return toolInfo
  }).join('\n\n')

  const systemPrompt = `You are an intelligent tool selection assistant for speech-to-text processing. Your job is to analyze transcribed speech and determine if any MCP (Model Context Protocol) tools should be used to process, enhance, or act upon the transcript.

IMPORTANT: You are processing speech-to-text transcripts from users. Only select tools when the user's speech clearly indicates they want to perform a specific action that matches an available tool.

## Available MCP Tools:
${toolsDescription}

## Decision Guidelines:

### WHEN TO USE TOOLS:
- User explicitly requests an action that matches a tool (e.g., "transcribe this audio file", "convert this text to speech")
- User mentions specific file paths or asks to process files
- User asks for information that requires API calls (e.g., "what models are available")
- User requests analysis, translation, or processing of content

### WHEN NOT TO USE TOOLS:
- Casual conversation or general speech
- System logs, debug output, or technical messages
- Incomplete sentences or unclear speech
- Questions about how to use the system
- Content that appears to be system-generated rather than user speech

### TOOL SELECTION CRITERIA:
1. **Relevance**: Tool must directly match user's stated intent
2. **Clarity**: User's request must be clear and specific
3. **Parameters**: You must be able to determine appropriate parameter values from the transcript
4. **Cost awareness**: Prefer tools that don't make API calls unless explicitly requested

### PARAMETER GUIDELINES:
- Extract file paths, text content, and settings from the user's speech
- Use reasonable defaults for optional parameters
- If required parameters cannot be determined from the transcript, do not select the tool

## Response Format:
Respond with a JSON object that includes:
- reasoning: Brief explanation of your decision
- shouldUseTool: boolean indicating if any tool should be used
- selectedTools: array of tools to execute (empty if shouldUseTool is false)

Be conservative - only use tools when there's clear user intent and benefit.`

  const userPrompt = `## Transcript to Analyze:
"${transcript}"

## Your Task:
1. Determine if this appears to be actual user speech (not system logs or debug output)
2. If it's user speech, identify what action or intent the user is expressing
3. Check if any available tools match the user's intent
4. If tools match, select the most appropriate ones and determine parameter values
5. Provide clear reasoning for your decision

Remember: Be conservative. Only select tools when the user clearly wants to perform a specific action that matches an available tool.`

  try {
    const chatProviderId = config.transcriptPostProcessingProviderId || "openai"

    console.log("🤖 MCP Tool Selection: Calling LLM for tool selection:", {
      provider: chatProviderId,
      model: chatProviderId === "gemini"
        ? config.transcriptPostProcessingGeminiModel || "gemini-1.5-flash-002"
        : chatProviderId === "groq"
        ? config.transcriptPostProcessingGroqModel || "gemma2-9b-it"
        : config.transcriptPostProcessingOpenaiModel || "gpt-4o-mini",
      toolsAvailable: availableTools.map(t => `${t.serverName}:${t.name}`).join(', ')
    })

    let result: ToolSelection
    if (chatProviderId === "gemini") {
      result = await selectToolsWithGemini(systemPrompt, userPrompt, config)
    } else {
      result = await selectToolsWithOpenAICompatible(systemPrompt, userPrompt, config, chatProviderId)
    }

    console.log("🎯 MCP Tool Selection Result:", {
      shouldUseTool: result.shouldUseTool,
      reasoning: result.reasoning,
      selectedToolsCount: result.selectedTools.length,
      selectedTools: result.selectedTools.map(t => `${t.serverName}:${t.toolName}`).join(', ')
    })

    return result
  } catch (error) {
    console.error("❌ MCP Tool Selection Failed:", {
      error: error instanceof Error ? error.message : 'Unknown error',
      transcript: transcript.slice(0, 50) + '...',
      provider: config.transcriptPostProcessingProviderId || "openai"
    })
    // Fallback to no tool selection
    return {
      reasoning: `LLM tool selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      shouldUseTool: false,
      selectedTools: []
    }
  }
}

async function selectToolsWithGemini(
  systemPrompt: string,
  userPrompt: string,
  config: any
): Promise<ToolSelection> {
  if (!config.geminiApiKey) {
    throw new Error("Gemini API key is required")
  }

  const gai = new GoogleGenerativeAI(config.geminiApiKey)
  const geminiModel = config.transcriptPostProcessingGeminiModel || "gemini-1.5-flash-002"
  const model = gai.getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      temperature: 0, // Use deterministic output for tool selection
      responseMimeType: "application/json",
      responseSchema: TOOL_SELECTION_SCHEMA as any
    }
  })

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`

  try {
    const result = await model.generateContent([fullPrompt], {
      baseUrl: config.geminiBaseUrl,
    })

    const responseText = result.response.text().trim()

    if (!responseText) {
      throw new Error("Empty response from Gemini")
    }

    const parsed = JSON.parse(responseText) as ToolSelection
    return validateToolSelection(parsed)
  } catch (error) {
    console.error("Gemini tool selection error:", error)
    throw error
  }
}

async function selectToolsWithOpenAICompatible(
  systemPrompt: string,
  userPrompt: string,
  config: any,
  providerId: string
): Promise<ToolSelection> {
  const baseUrl = providerId === "groq"
    ? config.groqBaseUrl || "https://api.groq.com/openai/v1"
    : config.openaiBaseUrl || "https://api.openai.com/v1"

  const apiKey = providerId === "groq" ? config.groqApiKey : config.openaiApiKey
  if (!apiKey) {
    throw new Error(`${providerId} API key is required`)
  }

  const model = providerId === "groq"
    ? config.transcriptPostProcessingGroqModel || "gemma2-9b-it"
    : config.transcriptPostProcessingOpenaiModel || "gpt-4o-mini"

  // Enhanced system prompt with explicit JSON formatting instructions
  const enhancedSystemPrompt = `${systemPrompt}

## CRITICAL: JSON Response Format
You MUST respond with a valid JSON object that exactly matches this schema:
${JSON.stringify(TOOL_SELECTION_SCHEMA, null, 2)}

Example valid response:
{
  "reasoning": "User is asking for general information, no tools needed",
  "shouldUseTool": false,
  "selectedTools": []
}

Do not include any text before or after the JSON object. The response must be parseable JSON.`

  const requestBody = {
    model,
    temperature: 0, // Deterministic output for tool selection
    max_tokens: 1000, // Reasonable limit for tool selection responses
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: enhancedSystemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`${providerId} API error (${response.status}): ${errorText.slice(0, 300)}`)
    }

    const json = await response.json()

    if (!json.choices || json.choices.length === 0) {
      throw new Error(`No choices returned from ${providerId} API`)
    }

    const content = json.choices[0].message?.content?.trim()

    if (!content) {
      throw new Error(`Empty content returned from ${providerId} API`)
    }

    const parsed = JSON.parse(content) as ToolSelection
    return validateToolSelection(parsed)
  } catch (error) {
    console.error(`${providerId} tool selection error:`, error)

    // If it's a JSON parse error, provide more context
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse ${providerId} response as JSON. Response may not be valid JSON format.`)
    }

    throw error
  }
}

/**
 * Validate that the tool selection response matches expected structure
 */
function validateToolSelection(selection: any): ToolSelection {
  if (!selection || typeof selection !== 'object') {
    throw new Error('Tool selection must be an object')
  }

  if (typeof selection.reasoning !== 'string') {
    throw new Error('Tool selection must include reasoning as string')
  }

  if (typeof selection.shouldUseTool !== 'boolean') {
    throw new Error('Tool selection must include shouldUseTool as boolean')
  }

  if (!Array.isArray(selection.selectedTools)) {
    throw new Error('Tool selection must include selectedTools as array')
  }

  // Validate each selected tool
  for (const tool of selection.selectedTools) {
    if (!tool.serverName || typeof tool.serverName !== 'string') {
      throw new Error('Each selected tool must have serverName as string')
    }
    if (!tool.toolName || typeof tool.toolName !== 'string') {
      throw new Error('Each selected tool must have toolName as string')
    }
    if (!tool.arguments || typeof tool.arguments !== 'object') {
      throw new Error('Each selected tool must have arguments as object')
    }
    if (typeof tool.priority !== 'number') {
      throw new Error('Each selected tool must have priority as number')
    }
  }

  return selection as ToolSelection
}
