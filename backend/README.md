# DharmaReels AI — backend (Phase 3)

End-to-end pipeline: **script → scenes → TTS → optional BGM mix → images → SRT → FFmpeg (Ken Burns + fades + subtitles) → MP4**, with **inline** or **BullMQ + Redis** job execution.

## Prerequisites

- **Node.js 20+**
- **FFmpeg** & **FFprobe** on `PATH`
- **Redis** (only when `USE_QUEUE=true`)

## Install & run

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

### API only (default: inline jobs)

`USE_QUEUE=false` — jobs run in-process after `POST /videos` (non-blocking `setImmediate`), same as earlier phases.

### API + worker (production-style)

Terminal 1 — Redis must be running.

```bash
# .env: USE_QUEUE=true REDIS_URL=redis://127.0.0.1:6379
npm run dev
```

Terminal 2:

```bash
npm run worker
```

Production:

```bash
npm run build
node dist/server.js
node dist/queue/worker.js
```

## Configuration (environment)

| Area | Variables |
|------|-----------|
| Core | `PORT`, `OUTPUT_DIR`, `ASSETS_DIR`, `STORAGE_PROVIDER` (`local` only for now) |
| AI | `TTS_PROVIDER`, `IMAGE_PROVIDER`, `OPENAI_*` |
| BGM | `BGM_PATH`, `BGM_VOICE_VOLUME` (default `1`), `BGM_MUSIC_VOLUME` (default `0.25`) |
| Visuals | `TRANSITION_FADE_SEC`, `KEN_BURNS_ZOOM_STEP`, `VIDEO_CRF`, `VIDEO_PRESET`, `VIDEO_AUDIO_BITRATE` |
| Queue | `USE_QUEUE`, `REDIS_URL`, `QUEUE_CONCURRENCY`, `JOB_ATTEMPTS` |
| FFmpeg | `FFMPEG_PATH`, `FFPROBE_PATH` |

If `BGM_PATH` is missing or unreadable, narration is used alone (no failure).

## API

| Method | Path | Description |
|--------|------|----------------|
| `POST` | `/videos` | Queue or start a job; **202** + `{ id, status }` |
| `GET` | `/videos/:id` | Status, `progress` (0–100), `meta`, `error` |
| `GET` | `/videos/:id/download` | MP4 when completed |
| `GET` | `/health` | `phase: 3`, `queue: bullmq \| inline` |

## Architecture (modules)

| Path | Role |
|------|------|
| `services/storageService.ts` | Local paths; swap for S3 uploads + signed URLs later |
| `services/audioMixService.ts` | Voice + looping BGM, `amix` with `duration=first` (voice length) |
| `services/transitionService.ts` | Ken Burns (`zoompan`) + per-scene fades |
| `services/videoGenerationService.ts` | Full filter graph: scenes → concat → `subtitles` burn-in → H.264 + AAC |
| `queue/videoQueue.ts` | BullMQ queue factory |
| `queue/worker.ts` | Worker process; runs `VideoPipeline.execute` |
| `services/pipeline/videoPipeline.ts` | Orchestration + progress callbacks |

## Job lifecycle

1. **POST /videos** — script validated; job id created (BullMQ `jobId` or in-memory id).
2. **Processing** — segmentation → TTS → mix → images → SRT → FFmpeg → cleanup work dir.
3. **Completed** — `outputPath` under `OUTPUT_DIR/<id>.mp4`; `meta.phase === 3`.
4. **Failed** — error on job (inline store or Bull `failedReason`); Bull may retry up to `JOB_ATTEMPTS`.

## Notes

- Image failures still fall back to placeholders (Phase 2 behavior).
- Work directory under `OUTPUT_DIR/<jobId>/` is deleted after a successful render; final MP4 is kept beside it.
- For very large scene counts, command-line length limits may apply; batching could be added later.
