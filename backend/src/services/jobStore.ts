import { randomUUID } from "node:crypto";
import type { JobStatus, VideoJob } from "../types/index.js";

function nowIso(): string {
  return new Date().toISOString();
}

/** In-memory job store for API+inline processing (no Redis). */
export class JobStore {
  private readonly jobs = new Map<string, VideoJob>();

  create(script: string): VideoJob {
    const id = randomUUID();
    const job: VideoJob = {
      id,
      status: "pending",
      script,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      progress: 0,
    };
    this.jobs.set(id, job);
    return job;
  }

  get(id: string): VideoJob | undefined {
    return this.jobs.get(id);
  }

  update(
    id: string,
    patch: Partial<Pick<VideoJob, "status" | "outputPath" | "error" | "meta" | "progress">>
  ): VideoJob | undefined {
    const cur = this.jobs.get(id);
    if (!cur) return undefined;
    const next: VideoJob = {
      ...cur,
      ...patch,
      updatedAt: nowIso(),
    };
    this.jobs.set(id, next);
    return next;
  }

  setStatus(id: string, status: JobStatus): VideoJob | undefined {
    return this.update(id, { status });
  }
}
