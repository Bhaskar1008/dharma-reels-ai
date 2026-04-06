import IORedis from "ioredis";
import { Queue } from "bullmq";
import type { AppConfig } from "../config/index.js";
import type { VideoRequestOptions } from "../types/index.js";

export const VIDEO_QUEUE_NAME = "dharma-reels-video";

/** BullMQ job name (first argument to `queue.add`). */
export const VIDEO_JOB_NAME = "render";

export interface VideoJobData {
  script: string;
  request?: VideoRequestOptions;
}

export function createVideoQueue(cfg: AppConfig): Queue<VideoJobData> {
  const connection = new IORedis(cfg.redisUrl, { maxRetriesPerRequest: null });
  return new Queue<VideoJobData>(VIDEO_QUEUE_NAME, { connection });
}
