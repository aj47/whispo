#!/usr/bin/env node

/**
 * Integration test script for Lightning Whisper MLX
 * This script tests the integration without running the full Electron app
 */

import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pythonScriptPath = path.join(__dirname, '../resources/python/lightning_whisper_transcriber.py')

console.log('🧪 Testing Lightning Whisper MLX Integration')
console.log('=' .repeat(50))

// Test 1: Check if Python script exists
console.log('1. Checking if Python script exists...')
if (fs.existsSync(pythonScriptPath)) {
  console.log('   ✅ Python script found')
} else {
  console.log('   ❌ Python script not found at:', pythonScriptPath)
  process.exit(1)
}

// Test 2: Check Python availability
console.log('\n2. Checking Python availability...')
const checkPython = () => {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['--version'], { stdio: 'pipe' })

    let output = ''
    child.stdout.on('data', (data) => {
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      output += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log('   ✅ Python3 available:', output.trim())
        resolve(true)
      } else {
        console.log('   ❌ Python3 not available')
        reject(new Error('Python3 not found'))
      }
    })

    child.on('error', (error) => {
      console.log('   ❌ Error checking Python:', error.message)
      reject(error)
    })
  })
}

// Test 3: Check dependencies
console.log('\n3. Checking Lightning Whisper MLX dependencies...')
const checkDependencies = () => {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [pythonScriptPath, '--check-deps'], { stdio: 'pipe' })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim())
          if (result.dependencies_installed) {
            console.log('   ✅ Lightning Whisper MLX dependencies are installed')
            resolve(true)
          } else {
            console.log('   ⚠️  Lightning Whisper MLX dependencies are not installed')
            console.log('   💡 You can install them by running: pip install lightning-whisper-mlx')
            resolve(false)
          }
        } catch (error) {
          console.log('   ❌ Error parsing dependency check result:', error.message)
          reject(error)
        }
      } else {
        console.log('   ❌ Dependency check failed:', stderr)
        reject(new Error('Dependency check failed'))
      }
    })

    child.on('error', (error) => {
      console.log('   ❌ Error running dependency check:', error.message)
      reject(error)
    })
  })
}

// Test 4: Platform detection
console.log('\n4. Checking platform compatibility...')
const isMacSilicon = process.platform === 'darwin' && process.arch === 'arm64'
if (isMacSilicon) {
  console.log('   ✅ Running on Mac Silicon (ARM64)')
} else {
  console.log('   ⚠️  Not running on Mac Silicon')
  console.log('   📝 Platform:', process.platform, 'Architecture:', process.arch)
  console.log('   💡 Lightning Whisper MLX is optimized for Mac Silicon devices')
}

// Test 5: Test script execution (without actual audio file)
const testScriptExecution = (depsInstalled) => {
  console.log('\n5. Testing script execution...')
  return new Promise((resolve, reject) => {
    // Test with a non-existent file to check error handling
    const child = spawn('python3', [pythonScriptPath, '/non/existent/file.webm'], { stdio: 'pipe' })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      // We expect this to fail with code 1
      if (code === 1) {
        try {
          const result = JSON.parse(stdout.trim())
          if (result.success === false && result.error) {
            // Check for expected error messages
            const expectedErrors = [
              'not found',
              'not installed',
              'lightning-whisper-mlx'
            ]

            const hasExpectedError = expectedErrors.some(err =>
              result.error.toLowerCase().includes(err.toLowerCase())
            )

            if (hasExpectedError) {
              console.log('   ✅ Script execution and error handling working correctly')
              console.log('   📝 Error message:', result.error)
              resolve(true)
            } else {
              console.log('   ❌ Unexpected error response:', result)
              reject(new Error('Unexpected error response'))
            }
          } else {
            console.log('   ❌ Unexpected response format:', result)
            reject(new Error('Unexpected response format'))
          }
        } catch (error) {
          console.log('   ❌ Error parsing script output:', error.message)
          console.log('   📝 stdout:', stdout)
          console.log('   📝 stderr:', stderr)
          reject(error)
        }
      } else {
        console.log('   ❌ Unexpected exit code:', code)
        console.log('   📝 stdout:', stdout)
        console.log('   📝 stderr:', stderr)
        reject(new Error('Unexpected exit code'))
      }
    })

    child.on('error', (error) => {
      console.log('   ❌ Error running script:', error.message)
      reject(error)
    })
  })
}

// Run all tests
async function runTests() {
  try {
    await checkPython()
    const depsInstalled = await checkDependencies()
    await testScriptExecution(depsInstalled)

    console.log('\n' + '='.repeat(50))
    console.log('🎉 Integration test completed successfully!')

    if (!isMacSilicon) {
      console.log('\n⚠️  Note: Lightning Whisper MLX is optimized for Mac Silicon devices')
    }

    if (!depsInstalled) {
      console.log('\n💡 To use Lightning Whisper MLX, install dependencies with:')
      console.log('   pip install lightning-whisper-mlx')
    }

    console.log('\n✅ The integration should work correctly in the Whispo app')

  } catch (error) {
    console.log('\n' + '='.repeat(50))
    console.log('❌ Integration test failed:', error.message)
    console.log('\n🔧 Please check the setup and try again')
    process.exit(1)
  }
}

runTests()
