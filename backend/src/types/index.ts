export type JobStatus = "pending" | "processing" | "completed" | "failed";

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
}

export interface CreateVideoBody {
  script: string;
}

/** Serializable result stored on BullMQ job completion. */
export interface VideoJobResult {
  outputPath: string;
  meta: Record<string, unknown>;
}
