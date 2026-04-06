import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import type { Request, Response } from "express";
import { Router } from "express";
import type { Queue } from "bullmq";
import { jobToVideoJob } from "../queue/bullJobMapper.js";
import type { VideoJobData } from "../queue/videoQueue.js";
import { VIDEO_JOB_NAME } from "../queue/videoQueue.js";
import type { JobStore } from "../services/jobStore.js";
import type { VideoPipeline } from "../services/pipeline/videoPipeline.js";
import type { VideoJobResult } from "../types/index.js";
import { parseVideoRequest } from "./videoRequestParse.js";

export interface VideosRouterDeps {
  useQueue: boolean;
  queue?: Queue<VideoJobData>;
  jobStore: JobStore;
  pipeline: VideoPipeline;
  jobAttempts: number;
}

function streamMp4WithRange(filePath: string, req: Request, res: Response): void {
  const stat = statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Cache-Control", "public, max-age=3600");

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) {
      res.status(416).end();
      return;
    }
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end = m[2] ? parseInt(m[2], 10) : fileSize - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end < start) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }
    end = Math.min(end, fileSize - 1);
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Content-Length", String(chunkSize));
    createReadStream(filePath, { start, end }).on("error", () => {
      if (!res.headersSent) res.status(500).end();
    }).pipe(res);
    return;
  }

  res.setHeader("Content-Length", String(fileSize));
  createReadStream(filePath).on("error", () => {
    if (!res.headersSent) res.status(500).end();
  }).pipe(res);
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

      const requestOpts = parseVideoRequest(req.body);

      if (useQueue) {
        if (!queue) {
          res.status(503).json({ error: "Queue mode enabled but Redis queue is not initialized" });
          return;
        }
        const id = randomUUID();
        await queue.add(
          VIDEO_JOB_NAME,
          { script, request: requestOpts },
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

      const job = jobStore.create(script, requestOpts);
      setImmediate(() => {
        void (async () => {
          try {
            jobStore.update(job.id, { status: "processing", progress: 0 });
            const result = await pipeline.execute(job.id, script, {
              request: requestOpts,
              onProgress: async (p) => {
                jobStore.update(job.id, { progress: p });
              },
              onMetaPatch: async (patch) => {
                jobStore.mergeMeta(job.id, patch);
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
          request: vj.request,
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
        request: job.request,
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

      const wantAttachment = req.query.attachment === "1" || req.query.download === "1";
      if (wantAttachment) {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="dharma-reels-${req.params.id}.mp4"`
        );
      }

      streamMp4WithRange(outputPath, req, res);
    } catch (err) {
      next(err);
    }
  });

  return r;
}
