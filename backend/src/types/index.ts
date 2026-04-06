export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type VoiceGender = "male" | "female";

export interface BackgroundMusicRequest {
  enabled: boolean;
  /** Prompt for future AI music generation (not wired to an API yet). */
  prompt?: string;
}

/** Options sent with POST /videos (stored on the job for GET + usage). */
export interface VideoRequestOptions {
  voiceGender?: VoiceGender;
  /** Default true. When false, captions are not burned into the MP4. */
  subtitlesEnabled?: boolean;
  backgroundMusic?: BackgroundMusicRequest;
}

export interface VideoJob {
  id: string;
  status: JobStatus;
  script: string;
  createdAt: string;
  updatedAt: string;
  /** 0–100 while processing when available. */
  progress?: number;
  outputPath?: string;
  error?: string;
  meta?: Record<string, unknown>;
  /** Echo of client request options. */
  request?: VideoRequestOptions;
}

export interface CreateVideoBody {
  script: string;
  voiceGender?: VoiceGender;
  subtitlesEnabled?: boolean;
  backgroundMusic?: BackgroundMusicRequest;
}

/** Serializable result stored on BullMQ job completion. */
export interface VideoJobResult {
  outputPath: string;
  meta: Record<string, unknown>;
}
