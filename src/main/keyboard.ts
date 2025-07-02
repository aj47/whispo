import {
  getWindowRendererHandlers,
  showPanelWindowAndStartRecording,
  stopRecordingAndHidePanelWindow,
  WINDOWS,
} from "./window"
import { systemPreferences } from "electron"
import { configStore } from "./config"
import { state } from "./state"
import { spawn, ChildProcess } from "child_process"
import path from "path"

const rdevPath = path
  .join(
    __dirname,
    `../../resources/bin/whispo-rs${process.env.IS_MAC ? "" : ".exe"}`,
  )
  .replace("app.asar", "app.asar.unpacked")

type RdevEvent = {
  event_type: "KeyPress" | "KeyRelease"
  data: {
    key: "ControlLeft" | "BackSlash" | string
  }
  time: {
    secs_since_epoch: number
  }
}

export const writeText = (text: string) => {
  return new Promise<void>((resolve, reject) => {
    const child: ChildProcess = spawn(rdevPath, ["write", text])

    let stderr = ""

    child.stderr?.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("error", (error) => {
      reject(new Error(`Failed to spawn process: ${error.message}`))
    })

    child.on("close", (code) => {
      // writeText will trigger KeyPress event of the key A
      // I don't know why
      keysPressed.clear()

      if (code === 0) {
        resolve()
      } else {
        const errorMessage = `child process exited with code ${code}${stderr.trim() ? `. stderr: ${stderr.trim()}` : ""}`
        reject(new Error(errorMessage))
      }
    })
  })
}

const processMcpShortcut = async () => {
  try {
    const { mcpClientManager } = await import("./mcp-client")
    const { clipboard } = await import("electron")
    const { isAccessibilityGranted } = await import("./utils")

    const clipboardText = clipboard.readText()
    if (!clipboardText.trim()) {
      console.log("MCP shortcut triggered but clipboard is empty")
      return
    }

    console.log("Processing clipboard content with MCP tools")
    const processedText = await mcpClientManager.processTranscriptWithTools(clipboardText)

    // Write the processed text back to clipboard and try to write to active window
    clipboard.writeText(processedText)
    if (isAccessibilityGranted()) {
      try {
        await writeText(processedText)
      } catch (error) {
        console.error(`Failed to write processed text:`, error)
      }
    }

    console.log("MCP processing completed")
  } catch (error) {
    console.error("Failed to process clipboard with MCP:", error)
  }
}

const parseEvent = (event: any) => {
  try {
    const e = JSON.parse(String(event))
    e.data = JSON.parse(e.data)
    return e as RdevEvent
  } catch {
    return null
  }
}

// keys that are currently pressed down without releasing
// excluding ctrl
// when other keys are pressed, pressing ctrl will not start recording
const keysPressed = new Map<string, number>()

const hasRecentKeyPress = () => {
  if (keysPressed.size === 0) return false

  const now = Date.now() / 1000
  return [...keysPressed.values()].some((time) => {
    // 10 seconds
    // for some weird reasons sometime KeyRelease event is missing for some keys
    // so they stay in the map
    // therefore we have to check if the key was pressed in the last 10 seconds
    return now - time < 10
  })
}

export function listenToKeyboardEvents() {
  let isHoldingCtrlKey = false
  let startRecordingTimer: NodeJS.Timeout | undefined
  let isPressedCtrlKey = false
  let isHoldingCtrlKeyForMcp = false
  let startMcpTimer: NodeJS.Timeout | undefined

  if (process.env.IS_MAC) {
    if (!systemPreferences.isTrustedAccessibilityClient(false)) {
      return
    }
  }

  const cancelRecordingTimer = () => {
    if (startRecordingTimer) {
      clearTimeout(startRecordingTimer)
      startRecordingTimer = undefined
    }
  }

  const cancelMcpTimer = () => {
    if (startMcpTimer) {
      clearTimeout(startMcpTimer)
      startMcpTimer = undefined
    }
  }

  const handleEvent = (e: RdevEvent) => {
    if (e.event_type === "KeyPress") {
      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = true
      }

      if (e.data.key === "Escape" && state.isRecording) {
        const win = WINDOWS.get("panel")
        if (win) {
          stopRecordingAndHidePanelWindow()
        }

        return
      }

      // Handle MCP shortcuts
      const config = configStore.get()
      if (config.mcpToolCallingEnabled && config.mcpToolCallingShortcut) {
        if (config.mcpToolCallingShortcut === "ctrl-slash") {
          if (e.data.key === "Slash" && isPressedCtrlKey) {
            processMcpShortcut()
            return
          }
        }
        // Note: hold-ctrl for MCP will be handled in the KeyRelease section
      }

      // Handle speech-to-text shortcuts
      if (config.shortcut === "ctrl-slash") {
        if (e.data.key === "Slash" && isPressedCtrlKey) {
          getWindowRendererHandlers("panel")?.startOrFinishRecording.send()
        }
      } else {
        // Handle hold-ctrl for speech-to-text
        if (e.data.key === "ControlLeft") {
          if (hasRecentKeyPress()) {
            console.log("ignore ctrl because other keys are pressed", [
              ...keysPressed.keys(),
            ])
            return
          }

          if (startRecordingTimer) {
            // console.log('already started recording timer')
            return
          }

          startRecordingTimer = setTimeout(() => {
            isHoldingCtrlKey = true

            console.log("start recording")

            showPanelWindowAndStartRecording()
          }, 800)

          // Also handle MCP hold-ctrl if enabled and configured differently than speech-to-text
          if (config.mcpToolCallingEnabled &&
              config.mcpToolCallingShortcut === "hold-ctrl" &&
              config.shortcut !== "hold-ctrl") {
            if (startMcpTimer) {
              return
            }

            startMcpTimer = setTimeout(() => {
              isHoldingCtrlKeyForMcp = true
              console.log("ready for MCP processing")
            }, 1200) // Slightly longer delay to differentiate from recording
          }
        } else {
          keysPressed.set(e.data.key, e.time.secs_since_epoch)
          cancelRecordingTimer()
          cancelMcpTimer()

          // when holding ctrl key, pressing any other key will stop recording
          if (isHoldingCtrlKey) {
            stopRecordingAndHidePanelWindow()
          }

          // when holding ctrl key for MCP, pressing any other key will trigger MCP processing
          if (isHoldingCtrlKeyForMcp) {
            processMcpShortcut()
          }

          isHoldingCtrlKey = false
          isHoldingCtrlKeyForMcp = false
        }
      }
    } else if (e.event_type === "KeyRelease") {
      keysPressed.delete(e.data.key)

      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = false
      }

      const config = configStore.get()
      if (config.shortcut === "ctrl-slash") return

      cancelRecordingTimer()
      cancelMcpTimer()

      if (e.data.key === "ControlLeft") {
        console.log("release ctrl")

        // Handle speech-to-text ctrl release
        if (isHoldingCtrlKey) {
          getWindowRendererHandlers("panel")?.finishRecording.send()
        } else {
          stopRecordingAndHidePanelWindow()
        }

        // Handle MCP ctrl release
        if (isHoldingCtrlKeyForMcp) {
          processMcpShortcut()
        }

        isHoldingCtrlKey = false
        isHoldingCtrlKeyForMcp = false
      }
    }
  }

  const child = spawn(rdevPath, ["listen"], {})

  child.stdout.on("data", (data) => {
    if (import.meta.env.DEV) {
      console.log(String(data))
    }

    const event = parseEvent(data)
    if (!event) return

    handleEvent(event)
  })
}
