import { Control, ControlGroup } from "@renderer/components/ui/control"
import { Input } from "@renderer/components/ui/input"
import { Button } from "@renderer/components/ui/button"
import { Switch } from "@renderer/components/ui/switch"
import { tipcClient } from "@renderer/lib/tipc-client"
import { useState, useEffect } from "react"
import { McpServerConfig } from "@shared/types"
import { useMutation, useQuery } from "@tanstack/react-query"
import { queryClient } from "@renderer/lib/query-client"

interface NewServerForm {
  name: string
  command: string
  args: string
  env: Record<string, string>
  enabled: boolean
}

export function Component() {
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [newServer, setNewServer] = useState<NewServerForm>({
    name: "",
    command: "",
    args: "",
    env: {},
    enabled: true,
  })

  const serversQuery = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: async () => {
      return tipcClient.getMcpServers()
    },
  })

  const connectedServersQuery = useQuery({
    queryKey: ["mcp-connected-servers"],
    queryFn: async () => {
      return tipcClient.getMcpConnectedServers()
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  const saveServersMutation = useMutation({
    mutationFn: async (servers: McpServerConfig[]) => {
      return tipcClient.saveMcpServers({ servers })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] })
      queryClient.invalidateQueries({ queryKey: ["mcp-connected-servers"] })
    },
  })

  useEffect(() => {
    if (serversQuery.data) {
      setServers(serversQuery.data)
    }
  }, [serversQuery.data])

  const addServer = () => {
    if (!newServer.name || !newServer.command) {
      alert("Please fill in server name and command")
      return
    }

    const server: McpServerConfig = {
      name: newServer.name,
      command: newServer.command,
      args: newServer.args.split(" ").filter(Boolean),
      env: newServer.env || {},
      enabled: newServer.enabled ?? true,
    }

    const updatedServers = [...servers, server]
    setServers(updatedServers)
    saveServersMutation.mutate(updatedServers)

    // Reset form
    setNewServer({
      name: "",
      command: "",
      args: "",
      env: {},
      enabled: true,
    })
  }

  const removeServer = (index: number) => {
    const updatedServers = servers.filter((_, i) => i !== index)
    setServers(updatedServers)
    saveServersMutation.mutate(updatedServers)
  }

  const toggleServer = (index: number) => {
    const updatedServers = servers.map((server, i) =>
      i === index ? { ...server, enabled: !server.enabled } : server
    )
    setServers(updatedServers)
    saveServersMutation.mutate(updatedServers)
  }

  const connectedServers = connectedServersQuery.data || []

  return (
    <div className="grid gap-4">
      <ControlGroup title="MCP Servers">
        <div className="space-y-4 p-3">
          {servers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No MCP servers configured. Add a server below to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {servers.map((server, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3 dark:border-neutral-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{server.name}</h4>
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${
                          connectedServers.includes(server.name)
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                        title={
                          connectedServers.includes(server.name)
                            ? "Connected"
                            : "Disconnected"
                        }
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {server.command} {server.args.join(" ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={() => toggleServer(index)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeServer(index)}
                      className="text-red-500 hover:text-red-600"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ControlGroup>

      <ControlGroup title="Add New Server">
        <div className="space-y-3 p-3">
          <Control label="Server Name">
            <Input
              value={newServer.name || ""}
              onChange={(e) =>
                setNewServer({ ...newServer, name: e.target.value })
              }
              placeholder="e.g., filesystem-server"
            />
          </Control>

          <Control label="Command">
            <Input
              value={newServer.command || ""}
              onChange={(e) =>
                setNewServer({ ...newServer, command: e.target.value })
              }
              placeholder="e.g., node, python, npx"
            />
          </Control>

          <Control label="Arguments">
            <Input
              value={newServer.args}
              onChange={(e) =>
                setNewServer({ ...newServer, args: e.target.value })
              }
              placeholder="e.g., server.js --port 3000"
            />
          </Control>

          <div className="flex justify-end">
            <Button onClick={addServer} disabled={saveServersMutation.isPending}>
              {saveServersMutation.isPending ? "Adding..." : "Add Server"}
            </Button>
          </div>
        </div>
      </ControlGroup>

      <ControlGroup title="Help">
        <div className="p-3 text-sm text-muted-foreground">
          <p className="mb-2">
            MCP (Model Context Protocol) servers provide tools that can be called with your transcripts.
          </p>
          <p className="mb-2">
            Examples of MCP servers:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><code>npx @modelcontextprotocol/server-filesystem</code> - File system operations</li>
            <li><code>npx @modelcontextprotocol/server-brave-search</code> - Web search</li>
            <li><code>python -m mcp_server_git</code> - Git operations</li>
          </ul>
          <p className="mt-2">
            Visit <a href="https://modelcontextprotocol.io" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
              modelcontextprotocol.io
            </a> for more information and available servers.
          </p>
        </div>
      </ControlGroup>
    </div>
  )
}
