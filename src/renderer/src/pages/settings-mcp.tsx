import { Control, ControlGroup } from "@renderer/components/ui/control"
import { Input } from "@renderer/components/ui/input"
import { Switch } from "@renderer/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select"
import { Button } from "@renderer/components/ui/button"
import {
  useConfigQuery,
  useSaveConfigMutation,
} from "@renderer/lib/query-client"
import { tipcClient } from "@renderer/lib/tipc-client"
import { Config } from "@shared/types"
import { useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

export function Component() {
  const configQuery = useConfigQuery()
  const saveConfigMutation = useSaveConfigMutation()
  const [mcpServers, setMcpServers] = useState<Array<{ id: string; name: string; toolCount: number }>>([])

  const saveConfig = (config: Partial<Config>) => {
    saveConfigMutation.mutate({
      config: {
        ...configQuery.data,
        ...config,
      },
    })
  }

  const initializeMcpMutation = useMutation({
    mutationFn: async (configPath?: string) => {
      await tipcClient.initializeMcp({ configPath })
      return await tipcClient.getMcpServers()
    },
    onSuccess: (servers) => {
      setMcpServers(servers)
    },
    onError: (error) => {
      console.error("Failed to initialize MCP:", error)
    }
  })

  const mcpToolsQuery = useQuery({
    queryKey: ["mcp-tools"],
    queryFn: () => tipcClient.getMcpTools(),
    enabled: configQuery.data?.mcpToolCallingEnabled === true,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const testMcpConnectionMutation = useMutation({
    mutationFn: async () => {
      const configPath = configQuery.data?.mcpServersConfigPath
      if (!configPath) {
        throw new Error("MCP servers config path not set")
      }
      return await initializeMcpMutation.mutateAsync(configPath)
    }
  })

  useEffect(() => {
    if (configQuery.data?.mcpToolCallingEnabled && configQuery.data?.mcpServersConfigPath) {
      initializeMcpMutation.mutate(configQuery.data.mcpServersConfigPath)
    }
  }, [configQuery.data?.mcpToolCallingEnabled, configQuery.data?.mcpServersConfigPath])

  if (!configQuery.data) return null

  const mcpToolCallingEnabled = configQuery.data.mcpToolCallingEnabled || false
  const mcpToolCallingShortcut = configQuery.data.mcpToolCallingShortcut || "hold-alt"
  const mcpServersConfigPath = configQuery.data.mcpServersConfigPath || ""

  return (
    <div className="grid gap-4">
      <ControlGroup title="MCP Tool Calling">
        <Control label="Enable MCP Tool Calling" className="px-3">
          <Switch
            checked={mcpToolCallingEnabled}
            onCheckedChange={(value) => {
              saveConfig({
                mcpToolCallingEnabled: value,
              })
            }}
          />
        </Control>

        {mcpToolCallingEnabled && (
          <>
            <Control label="Tool Calling Shortcut" className="px-3">
              <Select
                value={mcpToolCallingShortcut}
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
                  <SelectItem value="hold-alt">Hold Alt</SelectItem>
                  <SelectItem value="alt-slash">Alt+/</SelectItem>
                  <SelectItem value="ctrl-shift">Ctrl+Shift</SelectItem>
                </SelectContent>
              </Select>
            </Control>

            <Control label="MCP Servers Config Path" className="px-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="/path/to/mcp-servers-config.json"
                  value={mcpServersConfigPath}
                  onChange={(e) => {
                    saveConfig({
                      mcpServersConfigPath: e.currentTarget.value,
                    })
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMcpConnectionMutation.mutate()}
                  disabled={testMcpConnectionMutation.isPending || !mcpServersConfigPath}
                >
                  {testMcpConnectionMutation.isPending ? "Testing..." : "Test"}
                </Button>
              </div>
            </Control>
          </>
        )}
      </ControlGroup>

      {mcpToolCallingEnabled && mcpServers.length > 0 && (
        <ControlGroup title="Connected MCP Servers">
          <div className="px-3 space-y-2">
            {mcpServers.map((server) => (
              <div key={server.id} className="flex justify-between items-center p-2 bg-neutral-50 dark:bg-neutral-800 rounded">
                <div>
                  <div className="font-medium">{server.name}</div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    {server.toolCount} tools available
                  </div>
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Connected</div>
              </div>
            ))}
          </div>
        </ControlGroup>
      )}

      {mcpToolCallingEnabled && mcpToolsQuery.data && mcpToolsQuery.data.length > 0 && (
        <ControlGroup title="Available Tools">
          <div className="px-3 space-y-2 max-h-60 overflow-y-auto">
            {mcpToolsQuery.data.map((tool) => (
              <div key={`${tool.serverId}-${tool.name}`} className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded">
                <div className="font-medium">{tool.name}</div>
                {tool.description && (
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    {tool.description}
                  </div>
                )}
                <div className="text-xs text-neutral-500 dark:text-neutral-500">
                  Server: {tool.serverId}
                </div>
              </div>
            ))}
          </div>
        </ControlGroup>
      )}

      {mcpToolCallingEnabled && mcpServersConfigPath && (
        <ControlGroup title="Configuration Help">
          <div className="px-3 text-sm text-neutral-600 dark:text-neutral-400">
            <p className="mb-2">
              Create a JSON file with your MCP server configurations. Example:
            </p>
            <pre className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "filesystem": {
      "name": "File System Tools",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"],
      "description": "File system operations"
    },
    "brave-search": {
      "name": "Brave Search",
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key-here"
      },
      "description": "Web search capabilities"
    }
  }
}`}
            </pre>
          </div>
        </ControlGroup>
      )}
    </div>
  )
}
