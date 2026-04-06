import "dotenv/config";
import IORedis from "ioredis";
import { Worker } from "bullmq";
import { config } from "../config/index.js";
import { createVideoPipeline } from "../services/pipeline/createVideoPipeline.js";
import { log } from "../utils/logger.js";
import { VIDEO_JOB_NAME, VIDEO_QUEUE_NAME } from "./videoQueue.js";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
const pipeline = createVideoPipeline(config);

const worker = new Worker(
  VIDEO_QUEUE_NAME,
  async (job) => {
    let metaAcc: Record<string, unknown> = {};
    const result = await pipeline.execute(job.id as string, job.data.script, {
      request: job.data.request,
      onProgress: async (p) => {
        await job.updateProgress({ value: p, meta: { ...metaAcc } });
      },
      onMetaPatch: async (patch) => {
        metaAcc = { ...metaAcc, ...patch };
        const cur = job.progress;
        const v =
          typeof cur === "object" && cur !== null && "value" in cur
            ? Number((cur as { value?: number }).value)
            : typeof cur === "number"
              ? cur
              : 0;
        await job.updateProgress({ value: v, meta: { ...metaAcc } });
      },
    });
    return result;
  },
  {
    connection,
    concurrency: config.queueConcurrency,
    limiter: undefined,
  }
);

worker.on("completed", (job) => {
  log.info("Queue job completed", { id: job.id });
});

worker.on("failed", (job, err) => {
  log.error("Queue job failed", { id: job?.id, err });
});

worker.on("error", (err) => {
  log.error("Worker error", err);
});

log.info("DharmaReels worker listening", {
  queue: VIDEO_QUEUE_NAME,
  jobName: VIDEO_JOB_NAME,
  concurrency: config.queueConcurrency,
  redis: config.redisUrl,
});
