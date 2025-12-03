# Worker Module

Job processing worker implementation with modular architecture.

## Architecture

The worker module is refactored into multiple focused services and utilities:

### Core Files

- **`index.ts`** - Main entry point and orchestrator (~100 lines)
- **`types.ts`** - TypeScript interfaces and constants
- **`job-lifecycle.service.ts`** - Job lifecycle management
- **`job-steps.service.ts`** - Job processing steps
- **`nsfw-detector.ts`** - NSFW content detection

### Processing Modules

- **`downloader.ts`** - Input file downloading
- **`analyzer.ts`** - Media file analysis
- **`thumbnailer.ts`** - Preview/thumbnail generation
- **`processor.ts`** - Output processing (video/audio/subtitle)
- **`uploader.ts`** - Output file uploading
- **`notifier.ts`** - Job notifications

## Job Processing Flow

```
1. INITIALIZE    → Setup temp directories and services
2. DOWNLOAD      → Download input file
3. ANALYZE       → Extract media metadata
4. PREVIEW       → Generate preview + NSFW detection
5. PROCESS       → Process each output (video/audio/subtitle/thumbnail)
6. UPLOAD        → Upload processed outputs
7. FINALIZE      → Cleanup and stats update
```

## Progress Tracking

Each major step contributes **20%** to total progress:

- Download: 20%
- Analyze: 20%
- Processing: 20% (distributed across outputs)
- Upload: 20% (distributed across outputs)
- Preview/NSFW: Included in workflow

## Services

### JobLifecycleService

Manages job state and database operations:

- Job loading and parsing
- Status updates and notifications
- Worker status monitoring
- Final cleanup and stats calculation

### JobStepsService

Handles individual processing steps:

- Input download and validation
- Media analysis
- Preview generation
- Output processing (with callback)
- Output upload (with callback)
- Output validation

### NSFWDetector

Content safety detection:

- Configurable models (MobileNetV2, InceptionV3)
- Threshold-based classification
- Automatic disposal of TensorFlow tensors

## Error Handling

- Graceful error recovery with retry logic
- Detailed error logging with context
- Stats tracking for failed operations
- Cleanup on both success and failure

## Usage

Worker is spawned as a child process with arguments:

```bash
node worker/index.js <instanceKey> <workerKey> <jobKey>
```

## Dependencies

- `@voltage/config` - Configuration
- `@voltage/utils` - Database, logger, stats
- `@tensorflow/tfjs` - NSFW detection
- `ffmpeg` - Media processing
- `nsfwjs` - NSFW model
- `jimp` - Image manipulation
- `sharp` - Image processing

## Configuration

See `@voltage/config` for:

- Temp directory paths
- NSFW detection settings
- FFmpeg paths
- Storage configuration
- Processing timeouts
