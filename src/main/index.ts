import { app, Menu } from "electron"
import { electronApp, optimizer } from "@electron-toolkit/utils"
import {
  createMainWindow,
  createPanelWindow,
  createSetupWindow,
  makePanelWindowClosable,
  WINDOWS,
} from "./window"
import { listenToKeyboardEvents } from "./keyboard"
import { registerIpcMain } from "@egoist/tipc/main"
import { router } from "./tipc"
import { registerServeProtocol, registerServeSchema } from "./serve"
import { createAppMenu } from "./menu"
import { initTray } from "./tray"
import { isAccessibilityGranted } from "./utils"
import { mcpService } from "./mcp-service"
import { configStore } from "./config"

registerServeSchema()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId(process.env.APP_ID)

  const accessibilityGranted = isAccessibilityGranted()

  Menu.setApplicationMenu(createAppMenu())

  registerIpcMain(router)

  registerServeProtocol()

  if (accessibilityGranted) {
    createMainWindow()
  } else {
    createSetupWindow()
  }

  createPanelWindow()

  listenToKeyboardEvents()

  initTray()

  // Initialize MCP service if enabled
  const config = configStore.get()
  if (config.mcpToolCallingEnabled && config.mcpServersConfigPath) {
    mcpService.initialize(config.mcpServersConfigPath).catch(console.error)
  }

  import("./updater").then((res) => res.init()).catch(console.error)

  // Initialize MCP client manager
  import("./mcp-client").then(({ mcpClientManager }) => {
    // Auto-connect to MCP servers if enabled
    const config = require("./config").configStore.get()
    if (config.mcpToolCallingEnabled) {
      mcpClientManager.connectToAllServers().catch((error) => {
        console.error("Failed to auto-connect to MCP servers:", error)
      })
    }
  }).catch(console.error)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on("activate", function () {
    if (accessibilityGranted) {
      if (!WINDOWS.get("main")) {
        createMainWindow()
      }
    } else {
      if (!WINDOWS.get("setup")) {
        createSetupWindow()
      }
    }
  })

  app.on("before-quit", () => {
    makePanelWindowClosable()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
