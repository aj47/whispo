import { describe, it, expect, vi, beforeEach } from 'vitest'
import { spawn } from 'child_process'
import {
  checkLightningWhisperDependencies,
  installLightningWhisperDependencies,
  transcribeWithLightningWhisper
} from '../lightning-whisper-service'

// Mock child_process
vi.mock('child_process')
vi.mock('fs')
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn(() => '/mocked/dirname')
  }
})

const mockSpawn = vi.mocked(spawn)

// Mock global __dirname
global.__dirname = '/mocked/dirname'

describe('Lightning Whisper Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkLightningWhisperDependencies', () => {
    it('should return true when dependencies are installed', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('{"dependencies_installed": true}')
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        })
      }

      mockSpawn.mockReturnValue(mockChild as any)

      const result = await checkLightningWhisperDependencies()
      expect(result).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('python3', expect.arrayContaining(['--check-deps']), expect.any(Object))
    })

    it('should return false when dependencies are not installed', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('{"dependencies_installed": false}')
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        })
      }

      mockSpawn.mockReturnValue(mockChild as any)

      const result = await checkLightningWhisperDependencies()
      expect(result).toBe(false)
    })

    it('should reject when process fails', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn()
        },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('Error message')
            }
          })
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(1)
          }
        })
      }

      mockSpawn.mockReturnValue(mockChild as any)

      await expect(checkLightningWhisperDependencies()).rejects.toThrow()
    })
  })

  describe('installLightningWhisperDependencies', () => {
    it('should return true when installation succeeds', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('{"installation_success": true}')
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        })
      }

      mockSpawn.mockReturnValue(mockChild as any)

      const result = await installLightningWhisperDependencies()
      expect(result).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('python3', expect.arrayContaining(['--install-deps']), expect.any(Object))
    })
  })

  describe('transcribeWithLightningWhisper', () => {
    it('should successfully transcribe audio', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('{"success": true, "text": "Hello world", "model": "distil-medium.en"}')
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        })
      }

      mockSpawn.mockReturnValue(mockChild as any)

      // Mock fs operations
      const fs = await import('fs')
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined)

      const mockAudioBuffer = new ArrayBuffer(1024)
      const result = await transcribeWithLightningWhisper(mockAudioBuffer, {
        model: 'distil-medium.en',
        batchSize: 12,
        quant: null
      })

      expect(result.success).toBe(true)
      expect(result.text).toBe('Hello world')
      expect(result.model).toBe('distil-medium.en')
    })

    it('should handle transcription errors', async () => {
      const mockChild = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('{"success": false, "error": "Transcription failed"}')
            }
          })
        },
        stderr: {
          on: vi.fn()
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        })
      }

      mockSpawn.mockReturnValue(mockChild as any)

      // Mock fs operations
      const fs = await import('fs')
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined)

      const mockAudioBuffer = new ArrayBuffer(1024)
      const result = await transcribeWithLightningWhisper(mockAudioBuffer)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Transcription failed')
    })
  })
})
