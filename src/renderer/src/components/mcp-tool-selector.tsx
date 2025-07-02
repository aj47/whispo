import { Button } from "@renderer/components/ui/button"
import { useConfigQuery } from "@renderer/lib/query-client"
import { tipcClient } from "@renderer/lib/tipc-client"
import { cn } from "@renderer/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@renderer/components/ui/dialog"
import { Input } from "@renderer/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip"

interface McpToolSelectorProps {
  transcript: string
  className?: string
}

export function McpToolSelector({ transcript, className }: McpToolSelectorProps) {
  const configQuery = useConfigQuery()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedServerTool, setSelectedServerTool] = useState<string>("")
  const [toolArguments, setToolArguments] = useState<string>("{}")

  const mcpToolsQuery = useQuery({
    queryKey: ["mcp-tools"],
    queryFn: async () => {
      return tipcClient.getMcpTools()
    },
    enabled: configQuery.data?.mcpToolCallingEnabled === true,
  })

  const callToolMutation = useMutation({
    mutationFn: async ({
      serverName,
      toolName,
      arguments: args,
    }: {
      serverName: string
      toolName: string
      arguments: any
    }) => {
      return tipcClient.callMcpTool({ serverName, toolName, arguments: args })
    },
    onSuccess: (result) => {
      console.log("Tool call successful:", result)
      alert(`Tool executed successfully!\n\nResult: ${JSON.stringify(result, null, 2)}`)
      setIsOpen(false)
      setSelectedServerTool("")
      setToolArguments("{}")
    },
    onError: (error) => {
      console.error("Tool call error:", error)
      alert(`Error calling tool: ${error}`)
    },
  })

  // Don't show button if MCP is not enabled
  if (!configQuery.data?.mcpToolCallingEnabled) {
    return null
  }

  const availableServers = mcpToolsQuery.data || []

  const handleToolCall = () => {
    if (!selectedServerTool) return

    const [serverName, toolName] = selectedServerTool.split(':')
    if (!serverName || !toolName) return

    try {
      // Parse additional arguments and include transcript
      const additionalArgs = JSON.parse(toolArguments)
      const args = {
        transcript,
        ...additionalArgs,
      }

      callToolMutation.mutate({
        serverName,
        toolName,
        arguments: args,
      })
    } catch (error) {
      alert("Invalid JSON in additional arguments")
    }
  }

  // Find selected tool data
  let selectedToolData: any = null
  if (selectedServerTool) {
    const [serverName, toolName] = selectedServerTool.split(':')
    const server = availableServers.find(s => s.serverName === serverName)
    if (server) {
      selectedToolData = server.tools.find(tool => tool.name === toolName)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-6 h-6 rounded-md inline-flex items-center justify-center text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white",
                  className
                )}
                title="Select MCP Tool"
              >
                <span className="i-mingcute-tool-line"></span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Select and configure MCP tool
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select MCP Tool</DialogTitle>
          <DialogDescription>
            Choose a specific tool and configure its arguments for processing this transcript.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Available Tools</label>
            <select
              className="w-full mt-1 p-2 border rounded-md"
              value={selectedServerTool}
              onChange={(e) => {
                setSelectedServerTool(e.target.value)
                setToolArguments("{}") // Reset arguments when tool changes
              }}
            >
              <option value="">Choose a tool...</option>
              {availableServers.map((server) =>
                server.tools.map((tool) => (
                  <option key={`${server.serverName}:${tool.name}`} value={`${server.serverName}:${tool.name}`}>
                    {server.serverName} → {tool.name} - {tool.description || "No description"}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedToolData && (
            <div>
              <label className="text-sm font-medium">Tool Information</label>
              <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
                <div><strong>Name:</strong> {selectedToolData.name}</div>
                <div><strong>Description:</strong> {selectedToolData.description || "No description available"}</div>
                {selectedToolData.inputSchema && (
                  <div><strong>Schema:</strong> {JSON.stringify(selectedToolData.inputSchema, null, 2)}</div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Transcript</label>
            <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-md text-sm max-h-32 overflow-y-auto">
              {transcript}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Additional Arguments (JSON)</label>
            <Input
              placeholder='{"key": "value"}'
              value={toolArguments}
              onChange={(e) => setToolArguments(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              The transcript will be automatically included. Add any additional arguments here.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleToolCall}
              disabled={!selectedServerTool || callToolMutation.isPending}
              className="flex-1"
            >
              {callToolMutation.isPending ? "Executing..." : "Execute Tool"}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
