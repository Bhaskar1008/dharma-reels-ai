import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { createVideoQueue } from "./queue/videoQueue.js";
import { config } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createVideosRouter } from "./routes/videos.js";
import { JobStore } from "./services/jobStore.js";
import { createVideoPipeline } from "./services/pipeline/createVideoPipeline.js";

export function createApp() {
  const jobStore = new JobStore();
  const pipeline = createVideoPipeline(config);
  const queue = config.useQueue ? createVideoQueue(config) : undefined;

  const app = express();
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(cors());
  app.use(express.json({ limit: "512kb" }));
  if (config.nodeEnv !== "test") {
    app.use(morgan("combined"));
  }

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "dharma-reels-backend",
      phase: 3,
      queue: config.useQueue ? "bullmq" : "inline",
    });
  });

  app.use(
    "/videos",
    createVideosRouter({
      useQueue: config.useQueue,
      queue,
      jobStore,
      pipeline,
      jobAttempts: config.jobAttempts,
    })
  );

  app.use(errorHandler);
  return app;
}
