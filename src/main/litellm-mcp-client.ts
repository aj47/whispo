import { spawn } from "child_process"
import path from "path"
import { configStore } from "./config"

// Path to the Python LiteLLM MCP service script
const pythonScriptPath = path
  .join(__dirname, "../../src/main/litellm_mcp_service.py")
  .replace("app.asar", "app.asar.unpacked")

export interface LiteLLMToolCallResult {
  success: boolean
  content: string
  error?: string
  tool_name?: string
  server_name?: string
}

export interface LiteLLMConfig {
  model?: string
  apiKey?: string
  baseUrl?: string
  providerId?: string
}

/**
 * Elegant MCP Tool Calling Client using LiteLLM
 *
 * This provides a clean interface to the Python LiteLLM MCP service
 */
export class LiteLLMMCPClient {
  private config: LiteLLMConfig

  constructor(config: LiteLLMConfig = {}) {
    this.config = config
  }

  /**
   * Process transcript using LiteLLM with MCP tools
   * This is the main elegant interface that handles everything automatically
   */
  async processTranscript(transcript: string): Promise<LiteLLMToolCallResult> {
    const config = configStore.get()

    // Determine which LLM provider and model to use
    const providerId = this.config.providerId || config.transcriptPostProcessingProviderId || "openai"
    const model = this._getModelForProvider(providerId, config)
    const apiKey = this._getApiKeyForProvider(providerId, config)
    const baseUrl = this._getBaseUrlForProvider(providerId, config)

    console.log("🤖 LiteLLM MCP: Processing transcript with elegant tool calling:", {
      provider: providerId,
      model,
      hasApiKey: !!apiKey,
      baseUrl,
      transcriptLength: transcript.length
    })

    try {
      console.log("🔍 DEBUG: Calling Python MCP service...")
      const result = await this._callPythonService(transcript, model, apiKey, baseUrl)

      console.log("✅ LiteLLM MCP: Tool calling completed:", {
        success: result.success,
        hasContent: !!result.content,
        toolUsed: result.tool_name ? `${result.server_name}:${result.tool_name}` : "none",
        error: result.error
      })

      return result
    } catch (error) {
      console.error("❌ LiteLLM MCP: Tool calling failed:", error)
      return {
        success: false,
        content: transcript, // Fallback to original transcript
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  /**
   * Test connection to MCP servers
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this._callPythonService("test connection", "gpt-4o-mini", "test", undefined, true)
      return result.success
    } catch (error) {
      console.error("❌ LiteLLM MCP: Connection test failed:", error)
      return false
    }
  }

  private _getModelForProvider(providerId: string, config: any): string {
    switch (providerId) {
      case "gemini":
        return this.config.model || config.transcriptPostProcessingGeminiModel || "gemini-1.5-flash-002"
      case "groq":
        return this.config.model || config.transcriptPostProcessingGroqModel || "gemma2-9b-it"
      case "openai":
      default:
        return this.config.model || config.transcriptPostProcessingOpenaiModel || "gpt-4o-mini"
    }
  }

  private _getApiKeyForProvider(providerId: string, config: any): string {
    if (this.config.apiKey) return this.config.apiKey

    switch (providerId) {
      case "gemini":
        return config.geminiApiKey
      case "groq":
        return config.groqApiKey
      case "openai":
      default:
        return config.openaiApiKey
    }
  }

  private _getBaseUrlForProvider(providerId: string, config: any): string | undefined {
    if (this.config.baseUrl) return this.config.baseUrl

    switch (providerId) {
      case "groq":
        return config.groqBaseUrl || "https://api.groq.com/openai/v1"
      case "openai":
        return config.openaiBaseUrl || "https://api.openai.com/v1"
      case "gemini":
        return config.geminiBaseUrl
      default:
        return undefined
    }
  }

  private async _callPythonService(
    transcript: string,
    model: string,
    apiKey: string,
    baseUrl?: string,
    testMode: boolean = false
  ): Promise<LiteLLMToolCallResult> {
    console.log("🔍 DEBUG: _callPythonService called with:", {
      transcriptLength: transcript.length,
      model,
      hasApiKey: !!apiKey,
      baseUrl,
      testMode,
      pythonScriptPath
    })

    return new Promise((resolve, reject) => {
      const args = [pythonScriptPath]

      if (testMode) {
        args.push("--test")
      } else {
        args.push(transcript, model)
        if (apiKey) args.push(apiKey)
      }

      console.log("🔍 DEBUG: Python command args:", args)

      // Set environment variables for the Python process
      const env = { ...process.env }
      if (apiKey) {
        // Set appropriate environment variable based on provider
        if (model.includes("gpt") || model.includes("openai")) {
          env.OPENAI_API_KEY = apiKey
        } else if (model.includes("gemini")) {
          env.GEMINI_API_KEY = apiKey
        } else if (model.includes("groq") || model.includes("gemma")) {
          env.GROQ_API_KEY = apiKey
        }
      }
      if (baseUrl) {
        env.LITELLM_BASE_URL = baseUrl
      }

      const child = spawn("python3", args, {
        stdio: ["pipe", "pipe", "pipe"],
        env
      })

      let stdout = ""
      let stderr = ""

      child.stdout.on("data", (data) => {
        const output = data.toString()
        stdout += output
        console.log("🔍 DEBUG: Python stdout:", output.trim())
      })

      child.stderr.on("data", (data) => {
        const output = data.toString()
        stderr += output
        console.log("🔍 DEBUG: Python stderr:", output.trim())
      })

      child.on("close", (code) => {
        console.log("🔍 DEBUG: Python process closed with code:", code)
        console.log("🔍 DEBUG: Full stdout:", stdout)
        console.log("🔍 DEBUG: Full stderr:", stderr)

        if (code === 0) {
          try {
            // Try to parse the last line as JSON (the result)
            const lines = stdout.trim().split('\n')
            const lastLine = lines[lines.length - 1]
            console.log("🔍 DEBUG: Attempting to parse last line as JSON:", lastLine)

            // Look for JSON result in the output
            let result: LiteLLMToolCallResult
            try {
              result = JSON.parse(lastLine)
            } catch {
              // If last line isn't JSON, try to find JSON in the output
              const jsonMatch = stdout.match(/\{[^}]*"success"[^}]*\}/g)
              if (jsonMatch) {
                result = JSON.parse(jsonMatch[jsonMatch.length - 1])
              } else {
                // Fallback: create result from output
                result = {
                  success: true,
                  content: stdout.trim() || transcript
                }
              }
            }

            resolve(result)
          } catch (error) {
            reject(new Error(`Failed to parse Python service result: ${error}`))
          }
        } else {
          reject(new Error(`Python service failed with code ${code}: ${stderr}`))
        }
      })

      child.on("error", (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`))
      })
    })
  }
}

/**
 * Global instance for easy access
 */
export const liteLLMMCPClient = new LiteLLMMCPClient()

/**
 * Process transcript with elegant LiteLLM MCP tool calling
 * This is the main function that should replace the existing MCP tool calling logic
 */
export async function processTranscriptWithLiteLLM(transcript: string): Promise<string> {
  try {
    const result = await liteLLMMCPClient.processTranscript(transcript)

    if (result.success && result.content) {
      return result.content
    } else {
      console.warn("⚠️ LiteLLM MCP: Tool calling unsuccessful, returning original transcript")
      return transcript
    }
  } catch (error) {
    console.error("❌ LiteLLM MCP: Error processing transcript:", error)
    return transcript // Fallback to original transcript
  }
}
