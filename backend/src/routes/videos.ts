import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Router } from "express";
import type { Queue } from "bullmq";
import { jobToVideoJob } from "../queue/bullJobMapper.js";
import type { VideoJobData } from "../queue/videoQueue.js";
import { VIDEO_JOB_NAME } from "../queue/videoQueue.js";
import type { JobStore } from "../services/jobStore.js";
import type { VideoPipeline } from "../services/pipeline/videoPipeline.js";
import type { VideoJobResult } from "../types/index.js";

export interface VideosRouterDeps {
  useQueue: boolean;
  queue?: Queue<VideoJobData>;
  jobStore: JobStore;
  pipeline: VideoPipeline;
  jobAttempts: number;
}

export function createVideosRouter(deps: VideosRouterDeps): Router {
  const { useQueue, queue, jobStore, pipeline, jobAttempts } = deps;
  const r = Router();

  r.post("/", async (req, res, next) => {
    try {
      const script = typeof req.body?.script === "string" ? req.body.script.trim() : "";

      if (!script) {
        res.status(400).json({ error: "`script` must be a non-empty string" });
        return;
      }
      if (script.length > 50_000) {
        res.status(400).json({ error: "script too long (max 50000 characters)" });
        return;
      }

      if (useQueue) {
        if (!queue) {
          res.status(503).json({ error: "Queue mode enabled but Redis queue is not initialized" });
          return;
        }
        const id = randomUUID();
        await queue.add(
          VIDEO_JOB_NAME,
          { script },
          {
            jobId: id,
            attempts: jobAttempts,
            backoff: { type: "exponential", delay: 5000 },
          }
        );
        res.status(202).json({
          id,
          status: "pending",
          message: "Video job queued. Poll GET /videos/:id for status.",
        });
        return;
      }

      const job = jobStore.create(script);
      setImmediate(() => {
        void (async () => {
          try {
            jobStore.update(job.id, { status: "processing", progress: 0 });
            const result = await pipeline.execute(job.id, script, {
              onProgress: async (p) => {
                jobStore.update(job.id, { progress: p });
              },
            });
            jobStore.update(job.id, {
              status: "completed",
              outputPath: result.outputPath,
              meta: result.meta,
              progress: 100,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            jobStore.update(job.id, {
              status: "failed",
              error: message,
            });
          }
        })();
      });

      res.status(202).json({
        id: job.id,
        status: job.status,
        message: "Video generation started. Poll GET /videos/:id for status.",
      });
    } catch (err) {
      next(err);
    }
  });

  r.get("/:id", async (req, res, next) => {
    try {
      if (useQueue && queue) {
        const job = await queue.getJob(req.params.id);
        if (!job) {
          res.status(404).json({ error: "job not found" });
          return;
        }
        const vj = await jobToVideoJob(job);
        res.json({
          id: vj.id,
          status: vj.status,
          script: vj.script,
          progress: vj.progress,
          createdAt: vj.createdAt,
          updatedAt: vj.updatedAt,
          error: vj.error,
          meta: vj.meta,
        });
        return;
      }

      const job = jobStore.get(req.params.id);
      if (!job) {
        res.status(404).json({ error: "job not found" });
        return;
      }
      res.json({
        id: job.id,
        status: job.status,
        script: job.script,
        progress: job.progress,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        error: job.error,
        meta: job.meta,
      });
    } catch (err) {
      next(err);
    }
  });

  r.get("/:id/download", async (req, res, next) => {
    try {
      let outputPath: string | undefined;

      if (useQueue && queue) {
        const job = await queue.getJob(req.params.id);
        if (!job) {
          res.status(404).json({ error: "job not found" });
          return;
        }
        const state = await job.getState();
        if (state !== "completed") {
          res.status(409).json({
            error: "video not ready",
            status: state,
          });
          return;
        }
        const rv = job.returnvalue as VideoJobResult | undefined;
        outputPath = rv?.outputPath;
      } else {
        const job = jobStore.get(req.params.id);
        if (!job) {
          res.status(404).json({ error: "job not found" });
          return;
        }
        if (job.status !== "completed" || !job.outputPath) {
          res.status(409).json({
            error: "video not ready",
            status: job.status,
          });
          return;
        }
        outputPath = job.outputPath;
      }

      if (!outputPath || !existsSync(outputPath)) {
        res.status(500).json({ error: "output file missing on disk" });
        return;
      }

      res.download(outputPath, `dharma-reels-${req.params.id}.mp4`, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ error: "download failed" });
        }
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}
