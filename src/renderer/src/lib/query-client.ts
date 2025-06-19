import { focusManager, QueryClient, useMutation, useQuery } from "@tanstack/react-query"
import { tipcClient } from "./tipc-client"

focusManager.setEventListener((handleFocus) => {
  const handler = () => handleFocus()
  window.addEventListener("focus", handler)
  return () => {
    window.removeEventListener("focus", handler)
  }
})

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
    },
  },
})

export const useMicrphoneStatusQuery = () =>
  useQuery({
    queryKey: ["microphone-status"],
    queryFn: async () => {
      return tipcClient.getMicrophoneStatus()
    },
  })

export const useConfigQuery = () => useQuery({
  queryKey: ["config"],
  queryFn: async () => {
    return tipcClient.getConfig()
  },
})

export const useIsMacSiliconQuery = () => useQuery({
  queryKey: ["is-mac-silicon"],
  queryFn: async () => {
    return tipcClient.isMacSilicon()
  },
})

export const useSaveConfigMutation = () => useMutation({
  mutationFn: tipcClient.saveConfig,
  onSuccess() {
    queryClient.invalidateQueries({
      queryKey: ["config"],
    })
  },
})
