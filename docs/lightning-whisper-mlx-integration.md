# Lightning Whisper MLX Integration

This document describes the integration of [lightning-whisper-mlx](https://github.com/aj47/lightning-whisper-mlx) as a local transcription provider in Whispo.

## Overview

Lightning Whisper MLX is an extremely fast implementation of Whisper optimized for Apple Silicon using MLX. This integration provides Mac Silicon users with a high-performance local transcription option as an alternative to cloud-based services.

## Features

- **Local Processing**: No data sent to external services
- **High Performance**: Optimized for Apple Silicon (M1/M2/M3) chips
- **Multiple Models**: Support for various Whisper models including distilled versions
- **Quantization**: 4-bit and 8-bit quantization options for faster processing
- **Batch Processing**: Configurable batch sizes for optimal performance
- **Fallback Support**: Automatic fallback to OpenAI if local transcription fails

## Platform Requirements

- **macOS**: Required
- **Apple Silicon**: ARM64 architecture (M1/M2/M3 chips)
- **Python 3**: Python 3.7 or later
- **lightning-whisper-mlx**: Installed via pip

## Installation

### Automatic Installation

The Whispo app includes an automatic dependency installer:

1. Open Whispo settings
2. Navigate to "Speech to Text" section
3. Select "Lightning Whisper MLX (Local)" as the provider
4. Click "Check Dependencies" to verify installation
5. If not installed, click "Install" to automatically install dependencies

### Manual Installation

If automatic installation fails, install manually:

```bash
pip install lightning-whisper-mlx
```

## Model Management

**Important**: Model files are **not** stored in the Whispo repository. They are downloaded automatically by lightning-whisper-mlx when first used.

### Model Storage

- Models are downloaded to: `~/.cache/huggingface/transformers/`
- First use of each model will trigger automatic download
- Model files can be large (70MB+ for some models)
- Models are cached locally for subsequent use

### Repository Policy

The Whispo repository excludes:
- Model files (*.npz, *.safetensors, *.bin, etc.)
- Model cache directories
- Python cache files
- Temporary files

This keeps the repository lightweight and ensures users get the latest model versions.

## Configuration Options

### Model Selection

Available models (in order of speed vs. accuracy):

- **tiny**: Fastest, lowest accuracy
- **small**: Fast, good for simple audio
- **distil-small.en**: Optimized small model (English only)
- **base**: Balanced speed and accuracy
- **medium**: Good accuracy, moderate speed
- **distil-medium.en**: Optimized medium model (English only) - **Default**
- **large**: High accuracy, slower
- **large-v2**: Improved large model
- **distil-large-v2**: Optimized large model
- **large-v3**: Latest large model
- **distil-large-v3**: Latest optimized large model

### Batch Size

- **Range**: 1-32
- **Default**: 12
- **Higher values**: Better throughput but more memory usage
- **Lower values**: Less memory usage but slower processing

### Quantization

- **None**: Full precision (default)
- **4-bit**: Faster memory movement, slight quality reduction
- **8-bit**: Balance between speed and quality

## Performance Characteristics

- **Speed**: 10x faster than Whisper CPP, 4x faster than standard MLX Whisper
- **Memory**: Varies by model and batch size
- **Quality**: Comparable to OpenAI Whisper models

## Error Handling

The integration includes comprehensive error handling:

1. **Dependency Check**: Verifies lightning-whisper-mlx installation
2. **Platform Detection**: Only available on Mac Silicon devices
3. **Automatic Fallback**: Falls back to OpenAI if local transcription fails
4. **User Feedback**: Clear error messages and installation guidance

## Testing

### Integration Test

Run the integration test to verify the setup:

```bash
pnpm test-lightning-whisper
```

This test verifies:
- Python availability
- Script execution
- Platform compatibility
- Dependency status
- Error handling

### Unit Tests

Run unit tests for the service module:

```bash
npx vitest run src/main/__tests__/lightning-whisper-service.test.ts
```

## Architecture

### Components

1. **Python Script** (`resources/python/lightning_whisper_transcriber.py`)
   - Interfaces with lightning-whisper-mlx library
   - Handles dependency checking and installation
   - Provides JSON output for Node.js integration

2. **Service Module** (`src/main/lightning-whisper-service.ts`)
   - Node.js interface to Python script
   - Manages temporary files and subprocess communication
   - Provides TypeScript types and error handling

3. **Main Integration** (`src/main/tipc.ts`)
   - Integrates with existing transcription pipeline
   - Handles provider selection and fallback logic
   - Maintains compatibility with post-processing

4. **UI Components** (`src/renderer/src/pages/settings-general.tsx`)
   - Platform-aware provider selection
   - Configuration options for model, batch size, and quantization
   - Dependency management interface

### Data Flow

1. User records audio in Whispo
2. Audio buffer passed to transcription service
3. If lightning-whisper-mlx selected and available:
   - Audio saved to temporary file
   - Python script called with configuration
   - Transcription result parsed and returned
4. If lightning-whisper-mlx fails:
   - Automatic fallback to OpenAI
   - Error logged for debugging
5. Result passed to post-processing pipeline
6. Final transcript delivered to user

## Troubleshooting

### Common Issues

1. **Dependencies not installed**
   - Use the "Install" button in settings
   - Or manually run: `pip install lightning-whisper-mlx`

2. **Python not found**
   - Ensure Python 3 is installed and in PATH
   - Try `python3 --version` in terminal

3. **Not on Mac Silicon**
   - Option only appears on ARM64 macOS devices
   - Use OpenAI or Groq providers on other platforms

4. **Memory issues**
   - Reduce batch size in settings
   - Use smaller model (e.g., distil-small.en)
   - Enable quantization (4-bit or 8-bit)

### Debug Information

Check the Electron console for detailed error messages:
- Open Developer Tools in Whispo
- Look for lightning-whisper related logs
- Check for Python subprocess errors

## Future Enhancements

Potential improvements for future versions:

1. **Model Caching**: Cache downloaded models for faster startup
2. **Streaming**: Real-time transcription during recording
3. **Language Detection**: Automatic language detection
4. **Custom Models**: Support for fine-tuned models
5. **Performance Monitoring**: Built-in performance metrics

## Contributing

To contribute to the lightning-whisper-mlx integration:

1. Test on different Mac Silicon devices
2. Report performance characteristics
3. Suggest UI improvements
4. Help with error handling edge cases

## References

- [Lightning Whisper MLX Repository](https://github.com/aj47/lightning-whisper-mlx)
- [MLX Framework](https://github.com/ml-explore/mlx)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [Whispo Documentation](../README.md)
