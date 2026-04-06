import "dotenv/config";
import { config } from "./config/index.js";
import { createApp } from "./app.js";

const app = createApp();
app.listen(config.port, () => {
  console.log(`DharmaReels API listening on http://localhost:${config.port}`);
  console.log(`TTS: ${config.ttsProvider} | Images: ${config.imageProvider} | Queue: ${config.useQueue ? "BullMQ" : "inline"}`);
  if (config.useQueue) {
    console.log(`Redis: ${config.redisUrl} — start worker: npm run worker`);
  }
});
