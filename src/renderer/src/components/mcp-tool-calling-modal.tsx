import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog"
import { Button } from "@renderer/components/ui/button"
import { Input } from "@renderer/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select"
import { Spinner } from "@renderer/components/ui/spinner"
import { tipcClient } from "@renderer/lib/tipc-client"
import { useCallMcpToolMutation } from "@renderer/lib/query-client"
import { McpTool, McpToolCallResult } from "@shared/types"

interface McpToolCallingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function McpToolCallingModal({ open, onOpenChange }: McpToolCallingModalProps) {
  const [tools, setTools] = useState<McpTool[]>([])
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null)
  const [toolArguments, setToolArguments] = useState<Record<string, any>>({})
  const [result, setResult] = useState<McpToolCallResult | null>(null)
  const [isLoadingTools, setIsLoadingTools] = useState(false)

  const callToolMutation = useCallMcpToolMutation()

  useEffect(() => {
    if (open) {
      loadTools()
      setSelectedTool(null)
      setToolArguments({})
      setResult(null)
    }
  }, [open])

  const loadTools = async () => {
    setIsLoadingTools(true)
    try {
      const mcpTools = await tipcClient.getMcpTools()
      setTools(mcpTools)
    } catch (error) {
      console.error("Failed to load MCP tools:", error)
    } finally {
      setIsLoadingTools(false)
    }
  }

  const handleToolSelect = (toolId: string) => {
    const tool = tools.find(t => `${t.serverId}-${t.name}` === toolId)
    setSelectedTool(tool || null)
    setToolArguments({})
    setResult(null)
  }

  const handleArgumentChange = (argName: string, value: any) => {
    setToolArguments(prev => ({
      ...prev,
      [argName]: value
    }))
  }

  const handleCallTool = async () => {
    if (!selectedTool) return

    try {
      const result = await callToolMutation.mutateAsync({
        toolName: selectedTool.name,
        serverId: selectedTool.serverId,
        arguments: toolArguments
      })
      setResult(result)
    } catch (error) {
      console.error("Failed to call tool:", error)
      setResult({
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      })
    }
  }

  const renderArgumentInput = (argName: string, argSchema: any) => {
    const value = toolArguments[argName] || ""
    
    if (argSchema.type === "string") {
      return (
        <Input
          key={argName}
          placeholder={argSchema.description || argName}
          value={value}
          onChange={(e) => handleArgumentChange(argName, e.target.value)}
        />
      )
    } else if (argSchema.type === "number") {
      return (
        <Input
          key={argName}
          type="number"
          placeholder={argSchema.description || argName}
          value={value}
          onChange={(e) => handleArgumentChange(argName, parseFloat(e.target.value) || 0)}
        />
      )
    } else if (argSchema.type === "boolean") {
      return (
        <Select
          key={argName}
          value={value.toString()}
          onValueChange={(val) => handleArgumentChange(argName, val === "true")}
        >
          <SelectTrigger>
            <SelectValue placeholder={argSchema.description || argName} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    
    // Fallback for complex types
    return (
      <Input
        key={argName}
        placeholder={`${argName} (JSON)`}
        value={typeof value === "string" ? value : JSON.stringify(value)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value)
            handleArgumentChange(argName, parsed)
          } catch {
            handleArgumentChange(argName, e.target.value)
          }
        }}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>MCP Tool Calling</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoadingTools ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium">Select Tool</label>
                <Select onValueChange={handleToolSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a tool to call" />
                  </SelectTrigger>
                  <SelectContent>
                    {tools.map((tool) => (
                      <SelectItem key={`${tool.serverId}-${tool.name}`} value={`${tool.serverId}-${tool.name}`}>
                        <div>
                          <div className="font-medium">{tool.name}</div>
                          <div className="text-xs text-neutral-500">
                            {tool.description} (Server: {tool.serverId})
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTool && (
                <div>
                  <label className="text-sm font-medium">Tool Arguments</label>
                  <div className="space-y-2 mt-2">
                    {selectedTool.inputSchema?.properties ? (
                      Object.entries(selectedTool.inputSchema.properties).map(([argName, argSchema]: [string, any]) => (
                        <div key={argName}>
                          <label className="text-xs text-neutral-600 dark:text-neutral-400">
                            {argName}
                            {selectedTool.inputSchema?.required?.includes(argName) && " *"}
                          </label>
                          {renderArgumentInput(argName, argSchema)}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-neutral-500">No arguments required</div>
                    )}
                  </div>
                </div>
              )}

              {selectedTool && (
                <Button
                  onClick={handleCallTool}
                  disabled={callToolMutation.isPending}
                  className="w-full"
                >
                  {callToolMutation.isPending ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Calling Tool...
                    </>
                  ) : (
                    "Call Tool"
                  )}
                </Button>
              )}

              {result && (
                <div>
                  <label className="text-sm font-medium">Result</label>
                  <div className={`mt-2 p-3 rounded border ${result.isError ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700'}`}>
                    {result.content.map((item, index) => (
                      <div key={index} className="mb-2 last:mb-0">
                        {item.type === "text" && (
                          <pre className="whitespace-pre-wrap text-sm">{item.text}</pre>
                        )}
                        {item.type === "image" && (
                          <img src={`data:${item.mimeType};base64,${item.data}`} alt="Tool result" className="max-w-full" />
                        )}
                        {item.type === "resource" && (
                          <div className="text-sm">
                            <div className="font-medium">Resource:</div>
                            <pre className="whitespace-pre-wrap">{item.text}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
