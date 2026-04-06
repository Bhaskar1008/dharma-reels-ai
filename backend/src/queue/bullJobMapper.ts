import type { Job } from "bullmq";
import type { JobStatus, VideoJob, VideoJobResult, VideoRequestOptions } from "../types/index.js";
import type { VideoJobData } from "./videoQueue.js";

function mapBullStateToStatus(state: string): JobStatus {
  switch (state) {
    case "waiting":
    case "delayed":
    case "paused":
      return "pending";
    case "active":
      return "processing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

export async function jobToVideoJob(job: Job<VideoJobData>): Promise<VideoJob> {
  const state = await job.getState();
  const status = mapBullStateToStatus(state);
  const progressRaw = job.progress;
  let progress = 0;
  let progressMeta: Record<string, unknown> | undefined;
  if (typeof progressRaw === "number") {
    progress = progressRaw;
  } else if (typeof progressRaw === "object" && progressRaw !== null && "value" in progressRaw) {
    const o = progressRaw as { value?: number; meta?: Record<string, unknown> };
    progress = typeof o.value === "number" ? o.value : 0;
    progressMeta = o.meta;
  }

  let outputPath: string | undefined;
  let meta: Record<string, unknown> | undefined;
  let error: string | undefined;

  if (state === "completed" && job.returnvalue) {
    const rv = job.returnvalue as VideoJobResult;
    outputPath = rv.outputPath;
    meta = rv.meta;
  } else if (progressMeta) {
    meta = progressMeta;
  }
  if (state === "failed") {
    error = job.failedReason ?? "job failed";
  }

  const updatedMs = job.finishedOn ?? job.processedOn ?? job.timestamp;

  const request = job.data.request as VideoRequestOptions | undefined;

  return {
    id: String(job.id),
    status,
    script: job.data.script,
    request,
    progress: status === "completed" ? 100 : Math.min(100, Math.round(progress)),
    createdAt: new Date(job.timestamp).toISOString(),
    updatedAt: new Date(updatedMs).toISOString(),
    outputPath,
    error,
    meta,
  };
}
