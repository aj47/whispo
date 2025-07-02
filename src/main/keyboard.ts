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
    key: "ControlLeft" | "BackSlash" | "AltLeft" | "ShiftLeft" | string
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
  let isPressedAltKey = false
  let isPressedShiftKey = false
  let startMcpToolCallingTimer: NodeJS.Timeout | undefined

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

  const cancelMcpToolCallingTimer = () => {
    if (startMcpToolCallingTimer) {
      clearTimeout(startMcpToolCallingTimer)
      startMcpToolCallingTimer = undefined
    }
  }

  const handleEvent = (e: RdevEvent) => {
    const config = configStore.get()

    if (e.event_type === "KeyPress") {
      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = true
      }
      if (e.data.key === "AltLeft") {
        isPressedAltKey = true
      }
      if (e.data.key === "ShiftLeft") {
        isPressedShiftKey = true
      }

      if (e.data.key === "Escape" && state.isRecording) {
        const win = WINDOWS.get("panel")
        if (win) {
          stopRecordingAndHidePanelWindow()
        }

        return
      }

      // Handle MCP tool calling shortcuts
      if (config.mcpToolCallingEnabled) {
        const mcpShortcut = config.mcpToolCallingShortcut || "hold-alt"

        if (mcpShortcut === "alt-slash" && e.data.key === "Slash" && isPressedAltKey) {
          getWindowRendererHandlers("panel")?.openMcpToolCalling.send()
          return
        } else if (mcpShortcut === "ctrl-shift" && isPressedCtrlKey && isPressedShiftKey) {
          getWindowRendererHandlers("panel")?.openMcpToolCalling.send()
          return
        } else if (mcpShortcut === "hold-alt" && e.data.key === "AltLeft") {
          if (hasRecentKeyPress()) {
            return
          }

          if (startMcpToolCallingTimer) {
            return
          }

          startMcpToolCallingTimer = setTimeout(() => {
            getWindowRendererHandlers("panel")?.openMcpToolCalling.send()
          }, 800)
          return
        }
      }

      if (configStore.get().shortcut === "ctrl-slash") {
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
        } else {
          keysPressed.set(e.data.key, e.time.secs_since_epoch)
          cancelRecordingTimer()
          cancelMcpToolCallingTimer()

          // when holding ctrl key, pressing any other key will stop recording
          if (isHoldingCtrlKey) {
            stopRecordingAndHidePanelWindow()
          }

          isHoldingCtrlKey = false
        }
      }
    } else if (e.event_type === "KeyRelease") {
      keysPressed.delete(e.data.key)

      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = false
      }
      if (e.data.key === "AltLeft") {
        isPressedAltKey = false
        cancelMcpToolCallingTimer()
      }
      if (e.data.key === "ShiftLeft") {
        isPressedShiftKey = false
      }

      if (configStore.get().shortcut === "ctrl-slash") return

      cancelRecordingTimer()

      if (e.data.key === "ControlLeft") {
        console.log("release ctrl")
        if (isHoldingCtrlKey) {
          getWindowRendererHandlers("panel")?.finishRecording.send()
        } else {
          stopRecordingAndHidePanelWindow()
        }

        isHoldingCtrlKey = false
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
