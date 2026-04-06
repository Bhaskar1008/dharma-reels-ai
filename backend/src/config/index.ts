import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..", "..");

function envString(key: string, defaultValue: string): string {
  const v = process.env[key];
  return v !== undefined && v !== "" ? v : defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function envFloat(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

function envBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function ttsProviderFromEnv(): "mock" | "openai" {
  return envString("TTS_PROVIDER", "mock") === "openai" ? "openai" : "mock";
}

function imageProviderFromEnv(): "mock" | "openai" {
  return envString("IMAGE_PROVIDER", "mock") === "openai" ? "openai" : "mock";
}

function storageProviderFromEnv(): "local" | "s3" {
  return envString("STORAGE_PROVIDER", "local") === "s3" ? "s3" : "local";
}

export const config = {
  nodeEnv: envString("NODE_ENV", "development"),
  port: envInt("PORT", 3001),
  outputDir: path.resolve(backendRoot, envString("OUTPUT_DIR", "./storage/output")),
  assetsDir: path.resolve(backendRoot, envString("ASSETS_DIR", "./storage/assets")),
  ttsProvider: ttsProviderFromEnv(),
  imageProvider: imageProviderFromEnv(),
  storageProvider: storageProviderFromEnv(),
  /** BullMQ: set USE_QUEUE=true and REDIS_URL for background workers. */
  useQueue: envBool("USE_QUEUE", false),
  redisUrl: envString("REDIS_URL", "redis://127.0.0.1:6379"),
  queueConcurrency: envInt("QUEUE_CONCURRENCY", 2),
  jobAttempts: envInt("JOB_ATTEMPTS", 2),
  /** When true, delete intermediate files under storage/output/<jobId>/ after success. Default keeps them for debugging. */
  cleanupJobWorkDir: envBool("VIDEO_CLEANUP_WORKDIR", false),
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    baseUrl: envString("OPENAI_API_BASE_URL", "https://api.openai.com/v1"),
    ttsModel: envString("OPENAI_TTS_MODEL", "tts-1"),
    ttsVoice: envString("OPENAI_TTS_VOICE", "alloy"),
    imageModel: envString("OPENAI_IMAGE_MODEL", "dall-e-3"),
    imageSize: envString("OPENAI_IMAGE_SIZE", "1024x1792"),
  },
  ffmpegPath: envString("FFMPEG_PATH", "ffmpeg"),
  ffprobePath: envString("FFPROBE_PATH", "ffprobe"),
  /** Optional path to BGM file (mp3/aac/wav). Empty = narration only. */
  bgmPath: process.env.BGM_PATH?.trim() || undefined,
  bgmVoiceVolume: envFloat("BGM_VOICE_VOLUME", 1.0),
  bgmMusicVolume: envFloat("BGM_MUSIC_VOLUME", 0.25),
  transition: {
    fadeSec: envFloat("TRANSITION_FADE_SEC", 0.35),
    kenBurnsZoomStep: envFloat("KEN_BURNS_ZOOM_STEP", 0.0012),
  },
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    /** Upper bound on output duration (seconds). Narration and timeline are trimmed to fit. */
    maxDurationSec: Math.max(1, envInt("VIDEO_MAX_DURATION_SEC", 60)),
    audioBitrate: envString("VIDEO_AUDIO_BITRATE", "192k"),
    crf: envInt("VIDEO_CRF", 23),
    preset: envString("VIDEO_PRESET", "medium"),
  },
} as const;

export type AppConfig = typeof config;
