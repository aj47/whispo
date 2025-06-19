import { Control, ControlGroup } from "@renderer/components/ui/control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select"
import { Switch } from "@renderer/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip"
import {
  CHAT_PROVIDER_ID,
  CHAT_PROVIDERS,
  STT_PROVIDER_ID,
  STT_PROVIDERS,
} from "@shared/index"
import { Textarea } from "@renderer/components/ui/textarea"
import { Input } from "@renderer/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@renderer/components/ui/dialog"
import { Button } from "@renderer/components/ui/button"
import {
  useConfigQuery,
  useSaveConfigMutation,
  useIsMacSiliconQuery,
} from "@renderer/lib/query-client"
import { tipcClient } from "@renderer/lib/tipc-client"
import { useState } from "react"
import { Config } from "@shared/types"

export function Component() {
  const configQuery = useConfigQuery()
  const isMacSiliconQuery = useIsMacSiliconQuery()
  const [isCheckingDeps, setIsCheckingDeps] = useState(false)
  const [isInstallingDeps, setIsInstallingDeps] = useState(false)
  const [depsInstalled, setDepsInstalled] = useState<boolean | null>(null)

  const saveConfigMutation = useSaveConfigMutation()

  const saveConfig = (config: Partial<Config>) => {
    saveConfigMutation.mutate({
      config: {
        ...configQuery.data,
        ...config,
      },
    })
  }

  const checkDependencies = async () => {
    setIsCheckingDeps(true)
    try {
      const installed = await tipcClient.checkLightningWhisperDependencies()
      setDepsInstalled(installed)
    } catch (error) {
      console.error("Failed to check dependencies:", error)
      setDepsInstalled(false)
    } finally {
      setIsCheckingDeps(false)
    }
  }

  const installDependencies = async () => {
    setIsInstallingDeps(true)
    try {
      const success = await tipcClient.installLightningWhisperDependencies()
      setDepsInstalled(success)
      if (!success) {
        alert("Failed to install lightning-whisper-mlx. Please install it manually using: pip install lightning-whisper-mlx")
      }
    } catch (error) {
      console.error("Failed to install dependencies:", error)
      alert("Failed to install lightning-whisper-mlx. Please install it manually using: pip install lightning-whisper-mlx")
      setDepsInstalled(false)
    } finally {
      setIsInstallingDeps(false)
    }
  }

  const sttProviderId: STT_PROVIDER_ID =
    configQuery.data?.sttProviderId || "openai"
  const shortcut = configQuery.data?.shortcut || "hold-ctrl"
  const transcriptPostProcessingProviderId: CHAT_PROVIDER_ID =
    configQuery.data?.transcriptPostProcessingProviderId || "openai"

  // Filter STT providers based on platform
  const availableSttProviders = STT_PROVIDERS.filter(provider => {
    if (provider.value === "lightning-whisper-mlx") {
      // Only show on Mac Silicon devices
      return isMacSiliconQuery.data === true
    }
    return true
  })



  if (!configQuery.data || isMacSiliconQuery.isLoading) return null

  return (
    <div className="grid gap-4">
      {process.env.IS_MAC && (
        <ControlGroup title="App">
          <Control label="Hide Dock Icon" className="px-3">
            <Switch
              defaultChecked={configQuery.data.hideDockIcon}
              onCheckedChange={(value) => {
                saveConfig({
                  hideDockIcon: value,
                })
              }}
            />
          </Control>
        </ControlGroup>
      )}

      <ControlGroup
        title="Shortcuts"
        endDescription={
          <div className="flex items-center gap-1">
            <div>
              {shortcut === "hold-ctrl"
                ? "Hold Ctrl key to record, release it to finish recording"
                : "Press Ctrl+/ to start and finish recording"}
            </div>
            <TooltipProvider disableHoverableContent delayDuration={0}>
              <Tooltip>
                <TooltipTrigger className="inline-flex items-center justify-center">
                  <span className="i-mingcute-information-fill text-base"></span>
                </TooltipTrigger>
                <TooltipContent collisionPadding={5}>
                  {shortcut === "hold-ctrl"
                    ? "Press any key to cancel"
                    : "Press Esc to cancel"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
      >
        <Control label="Recording" className="px-3">
          <Select
            defaultValue={shortcut}
            onValueChange={(value) => {
              saveConfig({
                shortcut: value as typeof configQuery.data.shortcut,
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
      </ControlGroup>

      <ControlGroup title="Speech to Text">
        <Control label="Provider" className="px-3">
          <Select
            defaultValue={sttProviderId}
            onValueChange={(value) => {
              saveConfig({
                sttProviderId: value as STT_PROVIDER_ID,
              })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableSttProviders.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Control>

        {sttProviderId === "lightning-whisper-mlx" && (
          <>
            <Control label="Dependencies" className="px-3">
              <div className="flex items-center gap-2">
                {depsInstalled === null ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkDependencies}
                    disabled={isCheckingDeps}
                  >
                    {isCheckingDeps ? "Checking..." : "Check Dependencies"}
                  </Button>
                ) : depsInstalled ? (
                  <span className="text-green-600 text-sm">✓ Dependencies installed</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 text-sm">✗ Dependencies not installed</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={installDependencies}
                      disabled={isInstallingDeps}
                    >
                      {isInstallingDeps ? "Installing..." : "Install"}
                    </Button>
                  </div>
                )}
              </div>
            </Control>

            <Control label="Model" className="px-3">
              <Select
                defaultValue={configQuery.data.lightningWhisperMlxModel || "distil-medium.en"}
                onValueChange={(value) => {
                  saveConfig({
                    lightningWhisperMlxModel: value,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiny">Tiny</SelectItem>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="distil-small.en">Distil Small (English)</SelectItem>
                  <SelectItem value="base">Base</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="distil-medium.en">Distil Medium (English)</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="large-v2">Large v2</SelectItem>
                  <SelectItem value="distil-large-v2">Distil Large v2</SelectItem>
                  <SelectItem value="large-v3">Large v3</SelectItem>
                  <SelectItem value="distil-large-v3">Distil Large v3</SelectItem>
                </SelectContent>
              </Select>
            </Control>

            <Control label="Batch Size" className="px-3">
              <Input
                type="number"
                min="1"
                max="32"
                defaultValue={configQuery.data.lightningWhisperMlxBatchSize || 12}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  if (!isNaN(value) && value > 0) {
                    saveConfig({
                      lightningWhisperMlxBatchSize: value,
                    })
                  }
                }}
              />
            </Control>

            <Control label="Quantization" className="px-3">
              <Select
                defaultValue={configQuery.data.lightningWhisperMlxQuant || "none"}
                onValueChange={(value) => {
                  saveConfig({
                    lightningWhisperMlxQuant: value === "none" ? null : value as "4bit" | "8bit",
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="4bit">4-bit</SelectItem>
                  <SelectItem value="8bit">8-bit</SelectItem>
                </SelectContent>
              </Select>
            </Control>
          </>
        )}
      </ControlGroup>

      <ControlGroup title="Transcript Post-Processing">
        <Control label="Enabled" className="px-3">
          <Switch
            defaultChecked={configQuery.data.transcriptPostProcessingEnabled}
            onCheckedChange={(value) => {
              saveConfig({
                transcriptPostProcessingEnabled: value,
              })
            }}
          />
        </Control>

        {configQuery.data.transcriptPostProcessingEnabled && (
          <>
            <Control label="Provider" className="px-3">
              <Select
                defaultValue={transcriptPostProcessingProviderId}
                onValueChange={(value) => {
                  saveConfig({
                    transcriptPostProcessingProviderId:
                      value as CHAT_PROVIDER_ID,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAT_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Control>

            <Control label="Model" className="px-3">
              <Input
                placeholder={
                  transcriptPostProcessingProviderId === "openai"
                    ? "gpt-4o-mini"
                    : transcriptPostProcessingProviderId === "groq"
                    ? "gemma2-9b-it"
                    : "gemini-1.5-flash-002"
                }
                defaultValue={
                  transcriptPostProcessingProviderId === "openai"
                    ? configQuery.data.transcriptPostProcessingOpenaiModel
                    : transcriptPostProcessingProviderId === "groq"
                    ? configQuery.data.transcriptPostProcessingGroqModel
                    : configQuery.data.transcriptPostProcessingGeminiModel
                }
                onChange={(e) => {
                  const value = e.currentTarget.value
                  if (transcriptPostProcessingProviderId === "openai") {
                    saveConfig({
                      transcriptPostProcessingOpenaiModel: value,
                    })
                  } else if (transcriptPostProcessingProviderId === "groq") {
                    saveConfig({
                      transcriptPostProcessingGroqModel: value,
                    })
                  } else {
                    saveConfig({
                      transcriptPostProcessingGeminiModel: value,
                    })
                  }
                }}
              />
            </Control>

            <Control label="Prompt" className="px-3">
              <div className="flex flex-col items-end gap-1 text-right">
                {configQuery.data.transcriptPostProcessingPrompt && (
                  <div className="line-clamp-3 text-sm text-neutral-500 dark:text-neutral-400">
                    {configQuery.data.transcriptPostProcessingPrompt}
                  </div>
                )}
                <Dialog>
                  <DialogTrigger className="" asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 px-2"
                    >
                      <span className="i-mingcute-edit-2-line"></span>
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Prompt</DialogTitle>
                    </DialogHeader>
                    <Textarea
                      rows={10}
                      defaultValue={
                        configQuery.data.transcriptPostProcessingPrompt
                      }
                      onChange={(e) => {
                        saveConfig({
                          transcriptPostProcessingPrompt: e.currentTarget.value,
                        })
                      }}
                    ></Textarea>
                    <div className="text-sm text-muted-foreground">
                      Use <span className="select-text">{"{transcript}"}</span>{" "}
                      placeholder to insert the original transcript
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Control>
          </>
        )}
      </ControlGroup>
    </div>
  )
}
