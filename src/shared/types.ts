import type { CHAT_PROVIDER_ID, STT_PROVIDER_ID } from "."

export type RecordingHistoryItem = {
  id: string
  createdAt: number
  duration: number
  transcript: string
}

export type McpServerConfig = {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  cwd?: string
  description?: string
}

export type McpServersConfig = {
  mcpServers: Record<string, McpServerConfig>
}

export type McpTool = {
  name: string
  description?: string
  inputSchema: any
  serverId: string
}

export type McpToolCallResult = {
  content: Array<{
    type: "text" | "image" | "resource"
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export type Config = {
  shortcut?: "hold-ctrl" | "ctrl-slash"
  hideDockIcon?: boolean

  sttProviderId?: STT_PROVIDER_ID

  openaiApiKey?: string
  openaiBaseUrl?: string

  groqApiKey?: string
  groqBaseUrl?: string
  groqSttPrompt?: string

  geminiApiKey?: string
  geminiBaseUrl?: string

  lightningWhisperMlxModel?: string
  lightningWhisperMlxBatchSize?: number
  lightningWhisperMlxQuant?: "4bit" | "8bit" | null

  transcriptPostProcessingEnabled?: boolean
  transcriptPostProcessingProviderId?: CHAT_PROVIDER_ID
  transcriptPostProcessingPrompt?: string
  transcriptPostProcessingOpenaiModel?: string
  transcriptPostProcessingGroqModel?: string
  transcriptPostProcessingGeminiModel?: string

  // MCP Tool Calling Settings
  mcpToolCallingEnabled?: boolean
  mcpToolCallingShortcut?: "hold-alt" | "alt-slash" | "ctrl-shift"
  mcpServersConfigPath?: string
}
