import type { Job } from "bullmq";
import type { JobStatus, VideoJob, VideoJobResult } from "../types/index.js";

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

export async function jobToVideoJob(job: Job<{ script: string }>): Promise<VideoJob> {
  const state = await job.getState();
  const status = mapBullStateToStatus(state);
  const progressRaw = job.progress;
  const progress =
    typeof progressRaw === "number"
      ? progressRaw
      : typeof progressRaw === "object" && progressRaw !== null && "value" in progressRaw
        ? Number((progressRaw as { value?: number }).value)
        : 0;

  let outputPath: string | undefined;
  let meta: Record<string, unknown> | undefined;
  let error: string | undefined;

  if (state === "completed" && job.returnvalue) {
    const rv = job.returnvalue as VideoJobResult;
    outputPath = rv.outputPath;
    meta = rv.meta;
  }
  if (state === "failed") {
    error = job.failedReason ?? "job failed";
  }

  const updatedMs = job.finishedOn ?? job.processedOn ?? job.timestamp;

  return {
    id: String(job.id),
    status,
    script: job.data.script,
    progress: status === "completed" ? 100 : Math.min(100, Math.round(progress)),
    createdAt: new Date(job.timestamp).toISOString(),
    updatedAt: new Date(updatedMs).toISOString(),
    outputPath,
    error,
    meta,
  };
}
