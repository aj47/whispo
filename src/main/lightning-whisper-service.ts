import { spawn } from "child_process"
import path from "path"
import fs from "fs"
import { promisify } from "util"

const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)

// Path to the Python transcriber script
const pythonScriptPath = path
  .join(__dirname, "../../resources/python/lightning_whisper_transcriber.py")
  .replace("app.asar", "app.asar.unpacked")

export interface LightningWhisperConfig {
  model?: string
  batchSize?: number
  quant?: "4bit" | "8bit" | null
}

export interface TranscriptionResult {
  success: boolean
  text?: string
  segments?: any[]
  language?: string
  model?: string
  batchSize?: number
  quant?: string | null
  error?: string
}

export interface DependencyCheckResult {
  dependencies_installed: boolean
}

export interface InstallationResult {
  installation_success: boolean
}

/**
 * Check if lightning-whisper-mlx dependencies are installed
 */
export async function checkLightningWhisperDependencies(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [pythonScriptPath, "--check-deps"], {
      stdio: ["pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      if (code === 0) {
        try {
          const result: DependencyCheckResult = JSON.parse(stdout.trim())
          resolve(result.dependencies_installed)
        } catch (error) {
          reject(new Error(`Failed to parse dependency check result: ${error}`))
        }
      } else {
        reject(new Error(`Dependency check failed with code ${code}: ${stderr}`))
      }
    })

    child.on("error", (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`))
    })
  })
}

/**
 * Install lightning-whisper-mlx dependencies
 */
export async function installLightningWhisperDependencies(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [pythonScriptPath, "--install-deps"], {
      stdio: ["pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      if (code === 0) {
        try {
          const result: InstallationResult = JSON.parse(stdout.trim())
          resolve(result.installation_success)
        } catch (error) {
          reject(new Error(`Failed to parse installation result: ${error}`))
        }
      } else {
        reject(new Error(`Installation failed with code ${code}: ${stderr}`))
      }
    })

    child.on("error", (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`))
    })
  })
}

/**
 * Transcribe audio using lightning-whisper-mlx
 */
export async function transcribeWithLightningWhisper(
  audioBuffer: ArrayBuffer,
  config: LightningWhisperConfig = {}
): Promise<TranscriptionResult> {
  // Create a temporary file for the audio
  const tempDir = path.join(__dirname, "../../temp")
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  const tempAudioPath = path.join(tempDir, `audio_${Date.now()}.webm`)

  try {
    // Write audio buffer to temporary file
    await writeFile(tempAudioPath, Buffer.from(audioBuffer))

    // Prepare Python command arguments
    const args = [pythonScriptPath, tempAudioPath]
    
    if (config.model) {
      args.push("--model", config.model)
    }
    
    if (config.batchSize) {
      args.push("--batch-size", config.batchSize.toString())
    }
    
    if (config.quant) {
      args.push("--quant", config.quant)
    }

    return new Promise((resolve, reject) => {
      const child = spawn("python3", args, {
        stdio: ["pipe", "pipe", "pipe"]
      })

      let stdout = ""
      let stderr = ""

      child.stdout.on("data", (data) => {
        stdout += data.toString()
      })

      child.stderr.on("data", (data) => {
        stderr += data.toString()
      })

      child.on("close", async (code) => {
        // Clean up temporary file
        try {
          await unlink(tempAudioPath)
        } catch (error) {
          console.warn(`Failed to clean up temporary file: ${error}`)
        }

        if (code === 0) {
          try {
            const result: TranscriptionResult = JSON.parse(stdout.trim())
            resolve(result)
          } catch (error) {
            reject(new Error(`Failed to parse transcription result: ${error}`))
          }
        } else {
          reject(new Error(`Transcription failed with code ${code}: ${stderr}`))
        }
      })

      child.on("error", async (error) => {
        // Clean up temporary file
        try {
          await unlink(tempAudioPath)
        } catch (cleanupError) {
          console.warn(`Failed to clean up temporary file: ${cleanupError}`)
        }
        reject(new Error(`Failed to spawn Python process: ${error.message}`))
      })
    })
  } catch (error) {
    // Clean up temporary file if it was created
    try {
      if (fs.existsSync(tempAudioPath)) {
        await unlink(tempAudioPath)
      }
    } catch (cleanupError) {
      console.warn(`Failed to clean up temporary file: ${cleanupError}`)
    }
    throw error
  }
}
