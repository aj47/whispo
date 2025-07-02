import { focusManager, QueryClient, useMutation, useQuery } from "@tanstack/react-query"
import { tipcClient } from "./tipc-client"
import { Config } from "@shared/types"

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

export const useMcpToolsQuery = () =>
  useQuery({
    queryKey: ["mcp-tools"],
    queryFn: async () => {
      return tipcClient.getMcpTools()
    },
  })

export const useMcpServersQuery = () =>
  useQuery({
    queryKey: ["mcp-servers"],
    queryFn: async () => {
      return tipcClient.getMcpServers()
    },
  })

export const useCallMcpToolMutation = () =>
  useMutation({
    mutationFn: async (input: { toolName: string; serverId: string; arguments: any }) => {
      return tipcClient.callMcpTool(input)
    },
  })
