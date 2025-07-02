import { useState } from "react"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { tipcClient } from "@renderer/lib/tipc-client"
import { useMcpConnectedServersQuery } from "@renderer/lib/query-client"
import { useQuery, useMutation } from "@tanstack/react-query"
import { cn } from "@renderer/lib/utils"
import { McpToolCallResult } from "@shared/types"

interface McpToolButtonProps {
  transcript: string
  className?: string
}

export function McpToolButton({ transcript, className }: McpToolButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedServer, setSelectedServer] = useState<string>("")
  const [selectedTool, setSelectedTool] = useState<string>("")
  const [result, setResult] = useState<McpToolCallResult | null>(null)

  const connectedServersQuery = useMcpConnectedServersQuery()

  const toolsQuery = useQuery({
    queryKey: ["mcp-tools", selectedServer],
    queryFn: async () => {
      if (!selectedServer) return []
      return tipcClient.listMcpTools({ serverName: selectedServer })
    },
    enabled: !!selectedServer,
  })

  const callToolMutation = useMutation({
    mutationFn: async ({
      serverName,
      toolName,
      transcript,
    }: {
      serverName: string
      toolName: string
      transcript: string
    }) => {
      return tipcClient.callMcpTool({
        serverName,
        toolName,
        arguments: {},
        transcript,
      })
    },
    onSuccess: (result) => {
      setResult(result)
    },
  })

  const handleCallTool = () => {
    if (!selectedServer || !selectedTool) {
      alert("Please select a server and tool")
      return
    }

    callToolMutation.mutate({
      serverName: selectedServer,
      toolName: selectedTool,
      transcript,
    })
  }

  const connectedServers = connectedServersQuery.data || []
  const tools = toolsQuery.data || []

  if (connectedServers.length === 0) {
    return null // Don't show button if no servers are connected
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-6 h-6 rounded-md inline-flex items-center justify-center text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white",
            className
          )}
          title="Call MCP Tool"
        >
          <span className="i-mingcute-tool-line"></span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call MCP Tool</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Server</label>
            <Select value={selectedServer} onValueChange={setSelectedServer}>
              <SelectTrigger>
                <SelectValue placeholder="Select a server" />
              </SelectTrigger>
              <SelectContent>
                {connectedServers.map((server) => (
                  <SelectItem key={server} value={server}>
                    {server}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedServer && (
            <div>
              <label className="text-sm font-medium">Tool</label>
              <Select value={selectedTool} onValueChange={setSelectedTool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tool" />
                </SelectTrigger>
                <SelectContent>
                  {tools.map((tool: any) => (
                    <SelectItem key={tool.name} value={tool.name}>
                      <div>
                        <div className="font-medium">{tool.name}</div>
                        {tool.description && (
                          <div className="text-xs text-muted-foreground">
                            {tool.description}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Transcript</label>
            <div className="mt-1 p-2 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
              {transcript}
            </div>
          </div>

          {result && (
            <div>
              <label className="text-sm font-medium">Result</label>
              <div
                className={cn(
                  "mt-1 p-2 rounded-md text-sm max-h-32 overflow-y-auto",
                  result.success
                    ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                    : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                )}
              >
                {result.success ? result.content : result.error}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false)
                setResult(null)
                setSelectedServer("")
                setSelectedTool("")
              }}
            >
              Close
            </Button>
            <Button
              onClick={handleCallTool}
              disabled={
                !selectedServer ||
                !selectedTool ||
                callToolMutation.isPending
              }
            >
              {callToolMutation.isPending ? "Calling..." : "Call Tool"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
