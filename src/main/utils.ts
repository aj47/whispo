import { systemPreferences } from "electron"

export const isAccessibilityGranted = () => {
  // Only run accessibility check on macOS
  if (process.platform !== "darwin") {
    return true
  }

  return systemPreferences.isTrustedAccessibilityClient(false)
}


