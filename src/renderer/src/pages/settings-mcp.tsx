import { Control, ControlGroup } from "@renderer/components/ui/control"
import { Input } from "@renderer/components/ui/input"
import { Switch } from "@renderer/components/ui/switch"
import { Button } from "@renderer/components/ui/button"
import { Textarea } from "@renderer/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select"
import {
  useConfigQuery,
  useSaveConfigMutation,
} from "@renderer/lib/query-client"
import { Config } from "@shared/types"
import { tipcClient } from "@renderer/lib/tipc-client"
import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"

export function Component() {
  const configQuery = useConfigQuery()
  const saveConfigMutation = useSaveConfigMutation()
  const [mcpServersJson, setMcpServersJson] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  const saveConfig = (config: Partial<Config>) => {
    saveConfigMutation.mutate({
      config: {
        ...configQuery.data,
        ...config,
      },
    })
  }

  // Query for MCP servers status
  const mcpServersQuery = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: async () => {
      return tipcClient.getMcpServers()
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  // Query for MCP tools
  const mcpToolsQuery = useQuery({
    queryKey: ["mcp-tools"],
    queryFn: async () => {
      return tipcClient.getMcpTools()
    },
    enabled: (mcpServersQuery.data?.length || 0) > 0,
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  // Load MCP servers config
  const loadConfigMutation = useMutation({
    mutationFn: tipcClient.loadMcpServersConfig,
    onSuccess: (data) => {
      if (data.success && data.config) {
        setMcpServersJson(JSON.stringify(data.config, null, 2))
      }
    },
  })

  // Save MCP servers config
  const saveMcpConfigMutation = useMutation({
    mutationFn: async (config: string) => {
      return tipcClient.saveMcpServersConfig({ config })
    },
    onSuccess: (data) => {
      if (data.success) {
        alert(`Configuration saved successfully to: ${data.path}`)
      } else {
        alert(`Failed to save configuration: ${data.error}`)
      }
    },
    onError: (error) => {
      alert(`Error saving configuration: ${error}`)
    },
  })

  // Connect to MCP servers
  const connectMutation = useMutation({
    mutationFn: tipcClient.connectToMcpServers,
    onMutate: () => {
      setIsConnecting(true)
    },
    onSettled: () => {
      setIsConnecting(false)
      mcpServersQuery.refetch()
      mcpToolsQuery.refetch()
    },
  })

  // Disconnect from MCP servers
  const disconnectMutation = useMutation({
    mutationFn: tipcClient.disconnectFromMcpServers,
    onSettled: () => {
      mcpServersQuery.refetch()
      mcpToolsQuery.refetch()
    },
  })

  useEffect(() => {
    loadConfigMutation.mutate()
  }, [])

  if (!configQuery.data) return null

  const connectedServers = mcpServersQuery.data || []
  const availableTools = mcpToolsQuery.data || []

  return (
    <div className="grid gap-4">
      <ControlGroup title="MCP Tool Calling">
        <Control label="Enable MCP Tool Calling" className="px-3">
          <Switch
            defaultChecked={configQuery.data.mcpToolCallingEnabled}
            onCheckedChange={(value) => {
              saveConfig({
                mcpToolCallingEnabled: value,
              })
            }}
          />
        </Control>

        <Control label="MCP Shortcut Key" className="px-3">
          <Select
            defaultValue={configQuery.data.mcpToolCallingShortcut || "hold-ctrl"}
            onValueChange={(value) => {
              saveConfig({
                mcpToolCallingShortcut: value as typeof configQuery.data.mcpToolCallingShortcut,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hold-ctrl">Hold Ctrl</SelectItem>
              <SelectItem value="ctrl-slash">Ctrl+{"/"}</SelectItem>
            </SelectContent>
          </Select>
        </Control>

        <Control label="MCP Servers Config Path" className="px-3">
          <Input
            placeholder="Path to mcp-servers.json"
            defaultValue={configQuery.data.mcpServersConfigPath}
            onChange={(e) => {
              saveConfig({
                mcpServersConfigPath: e.currentTarget.value,
              })
            }}
          />
        </Control>

        <Control label="Use Elegant LiteLLM MCP Integration" className="px-3">
          <div className="space-y-2">
            <Switch
              defaultChecked={configQuery.data.mcpUseLiteLLM !== false}
              onCheckedChange={(value) => {
                saveConfig({
                  mcpUseLiteLLM: value,
                })
              }}
            />
            <p className="text-xs text-muted-foreground">
              Use the elegant LiteLLM-based MCP tool calling system for better performance and reliability.
              When disabled, falls back to legacy tool selection methods.
            </p>
          </div>
        </Control>

        <Control label="Legacy LLM-Driven Tool Selection" className="px-3">
          <div className="space-y-2">
            <Switch
              defaultChecked={configQuery.data.mcpLLMToolSelectionEnabled !== false}
              onCheckedChange={(value) => {
                saveConfig({
                  mcpLLMToolSelectionEnabled: value,
                })
              }}
              disabled={configQuery.data.mcpUseLiteLLM !== false}
            />
            <p className="text-xs text-muted-foreground">
              {configQuery.data.mcpUseLiteLLM !== false
                ? "Disabled when using elegant LiteLLM integration above."
                : "Use the post-processing LLM to intelligently select and configure MCP tools based on speech content. When disabled, falls back to simple heuristic-based tool selection."
              }
            </p>
          </div>
        </Control>
      </ControlGroup>

      <ControlGroup title="Server Management">
        <Control label="Connection Status" className="px-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {connectedServers.length > 0
                ? `Connected to ${connectedServers.length} server(s)`
                : "No servers connected"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => connectMutation.mutate()}
                disabled={isConnecting || connectMutation.isPending}
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </Control>

        {connectedServers.length > 0 && (
          <Control label="Connected Servers" className="px-3">
            <div className="text-sm">
              {connectedServers.map((server, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  <span>{server}</span>
                </div>
              ))}
            </div>
          </Control>
        )}
      </ControlGroup>

      {availableTools.length > 0 && (
        <ControlGroup title="Available Tools">
          <div className="px-3">
            {availableTools.map(({ serverName, tools }) => (
              <div key={serverName} className="mb-4">
                <h4 className="font-medium text-sm mb-2">{serverName}</h4>
                <div className="space-y-1">
                  {tools.map((tool: any, index: number) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      <span className="font-mono">{tool.name}</span>
                      {tool.description && (
                        <span className="ml-2">- {tool.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ControlGroup>
      )}

      <ControlGroup title="Configuration">
        <div className="px-3">
          <div className="mb-2">
            <label className="text-sm font-medium">MCP Servers Configuration</label>
            <p className="text-xs text-muted-foreground mb-2">
              JSON configuration for MCP servers. Save to file and set path above.
            </p>
          </div>
          <Textarea
            placeholder={`{
  "mcpServers": {
    "example-server": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}`}
            value={mcpServersJson}
            onChange={(e) => setMcpServersJson(e.target.value)}
            className="font-mono text-xs"
            rows={12}
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadConfigMutation.mutate()}
              disabled={loadConfigMutation.isPending}
            >
              Load Config
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  JSON.parse(mcpServersJson) // Validate JSON
                  saveMcpConfigMutation.mutate(mcpServersJson)
                } catch (error) {
                  alert("Invalid JSON configuration! Please fix the JSON before saving.")
                }
              }}
              disabled={saveMcpConfigMutation.isPending}
            >
              {saveMcpConfigMutation.isPending ? "Saving..." : "Save Config"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  const parsed = JSON.parse(mcpServersJson)
                  console.log("Valid JSON:", parsed)
                  alert("Configuration is valid JSON!")
                } catch (error) {
                  alert("Invalid JSON configuration!")
                }
              }}
            >
              Validate JSON
            </Button>
          </div>
        </div>
      </ControlGroup>
    </div>
  )
}
