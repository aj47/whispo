import {
  getWindowRendererHandlers,
  showPanelWindowAndStartRecording,
  showPanelWindowAndStartMcpRecording,
  stopRecordingAndHidePanelWindow,
  WINDOWS,
} from "./window"
import { systemPreferences } from "electron"
import { configStore } from "./config"
import { state } from "./state"
import { spawn, ChildProcess } from "child_process"
import path from "path"
import { isAccessibilityGranted } from "./utils"

let binaryName: string;

switch (process.platform) {
  case 'darwin': // This is macOS
    binaryName = 'speakmcp-rs-mac';
    break;
  case 'win32': // This is Windows
    binaryName = 'speakmcp-rs.exe';
    break;
  case 'linux': // This is Linux
    binaryName = 'speakmcp-rs';
    break;
  default:
    throw new Error(`Unsupported platform for rdev: ${process.platform}`);
}

const rdevPath = path
  .join(__dirname, `../../resources/bin/${binaryName}`)
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

  // MCP tool calling state
  let isHoldingCtrlAltKey = false
  let startMcpRecordingTimer: NodeJS.Timeout | undefined
  let isPressedCtrlAltKey = false

  if (!isAccessibilityGranted()) {
    return
  }

  const cancelRecordingTimer = () => {
    if (startRecordingTimer) {
      clearTimeout(startRecordingTimer)
      startRecordingTimer = undefined
    }
  }

  const cancelMcpRecordingTimer = () => {
    if (startMcpRecordingTimer) {
      clearTimeout(startMcpRecordingTimer)
      startMcpRecordingTimer = undefined
    }
  }

  const handleEvent = (e: RdevEvent) => {
    console.log(`[MCP-DEBUG] Key event: ${e.event_type} - ${e.data.key}`)

    if (e.event_type === "KeyPress") {
      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = true
        console.log(`[MCP-DEBUG] ControlLeft pressed, isPressedCtrlKey: ${isPressedCtrlKey}`)
      }

      if (e.data.key === "Alt") {
        isPressedCtrlAltKey = isPressedCtrlKey && true
        console.log(`[MCP-DEBUG] Alt pressed, isPressedCtrlKey: ${isPressedCtrlKey}, isPressedCtrlAltKey: ${isPressedCtrlAltKey}`)
      }

      if (e.data.key === "Escape" && state.isRecording) {
        console.log(`[MCP-DEBUG] Escape pressed while recording, stopping recording`)
        const win = WINDOWS.get("panel")
        if (win) {
          stopRecordingAndHidePanelWindow()
        }

        return
      }

      // Handle MCP tool calling shortcuts
      const config = configStore.get()
      console.log(`[MCP-DEBUG] Config check - mcpToolsEnabled: ${config.mcpToolsEnabled}, mcpToolsShortcut: ${config.mcpToolsShortcut}`)

      if (config.mcpToolsEnabled && config.mcpToolsShortcut === "ctrl-alt-slash") {
        console.log(`[MCP-DEBUG] Checking ctrl-alt-slash shortcut - key: ${e.data.key}, isPressedCtrlKey: ${isPressedCtrlKey}, isPressedCtrlAltKey: ${isPressedCtrlAltKey}`)
        if (e.data.key === "Slash" && isPressedCtrlKey && isPressedCtrlAltKey) {
          console.log(`[MCP-DEBUG] ✅ Ctrl+Alt+Slash detected! Triggering MCP recording`)
          getWindowRendererHandlers("panel")?.startOrFinishMcpRecording.send()
          return
        }
      }

      if (config.shortcut === "ctrl-slash") {
        if (e.data.key === "Slash" && isPressedCtrlKey) {
          getWindowRendererHandlers("panel")?.startOrFinishRecording.send()
        }
      } else {
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
        } else if (e.data.key === "Alt" && isPressedCtrlKey && config.mcpToolsEnabled && config.mcpToolsShortcut === "hold-ctrl-alt") {
          console.log(`[MCP-DEBUG] Hold-ctrl-alt shortcut detected - Alt pressed while ControlLeft held`)

          if (hasRecentKeyPress()) {
            console.log("[MCP-DEBUG] Ignoring ctrl+alt because other keys are pressed", [
              ...keysPressed.keys(),
            ])
            return
          }

          if (startMcpRecordingTimer) {
            console.log("[MCP-DEBUG] MCP recording timer already started, ignoring")
            return
          }

          // Cancel the regular recording timer since we're starting MCP mode
          console.log("[MCP-DEBUG] Cancelling regular recording timer for MCP mode")
          cancelRecordingTimer()

          console.log("[MCP-DEBUG] Starting MCP recording timer (800ms)")
          startMcpRecordingTimer = setTimeout(() => {
            isHoldingCtrlAltKey = true
            console.log(`[MCP-DEBUG] ✅ MCP recording timer triggered! isHoldingCtrlAltKey set to: ${isHoldingCtrlAltKey}`)

            console.log("[MCP-DEBUG] Starting MCP recording")

            showPanelWindowAndStartMcpRecording()
          }, 800)
        } else {
          keysPressed.set(e.data.key, e.time.secs_since_epoch)
          cancelRecordingTimer()
          cancelMcpRecordingTimer()

          // when holding ctrl key, pressing any other key will stop recording
          if (isHoldingCtrlKey) {
            stopRecordingAndHidePanelWindow()
          }

          // when holding ctrl+alt key, pressing any other key will stop MCP recording
          if (isHoldingCtrlAltKey) {
            stopRecordingAndHidePanelWindow()
          }

          isHoldingCtrlKey = false
          isHoldingCtrlAltKey = false
        }
      }
    } else if (e.event_type === "KeyRelease") {
      console.log(`[MCP-DEBUG] Key release: ${e.data.key}`)
      keysPressed.delete(e.data.key)

      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = false
        console.log(`[MCP-DEBUG] ControlLeft released, isPressedCtrlKey: ${isPressedCtrlKey}`)
      }

      if (e.data.key === "Alt") {
        isPressedCtrlAltKey = false
        console.log(`[MCP-DEBUG] Alt released, isPressedCtrlAltKey: ${isPressedCtrlAltKey}`)
      }

      if (configStore.get().shortcut === "ctrl-slash") return

      cancelRecordingTimer()
      cancelMcpRecordingTimer()

      if (e.data.key === "ControlLeft") {
        console.log("release ctrl")
        if (isHoldingCtrlKey) {
          getWindowRendererHandlers("panel")?.finishRecording.send()
        } else {
          stopRecordingAndHidePanelWindow()
        }

        isHoldingCtrlKey = false
      }

      if (e.data.key === "Alt") {
        console.log(`[MCP-DEBUG] release alt - isHoldingCtrlAltKey: ${isHoldingCtrlAltKey}`)
        if (isHoldingCtrlAltKey) {
          console.log("[MCP-DEBUG] ✅ Finishing MCP recording")
          const panelHandlers = getWindowRendererHandlers("panel")
          console.log(`[MCP-DEBUG] Panel handlers available: ${!!panelHandlers}`)
          panelHandlers?.finishMcpRecording.send()
          console.log("[MCP-DEBUG] finishMcpRecording.send() called")
        } else {
          console.log("[MCP-DEBUG] ❌ Stopping recording and hiding panel (not holding)")
          stopRecordingAndHidePanelWindow()
        }

        isHoldingCtrlAltKey = false
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
