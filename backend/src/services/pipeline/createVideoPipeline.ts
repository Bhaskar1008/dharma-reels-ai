import type { AppConfig } from "../../config/index.js";
import { createImageGenerator } from "../imageGenerationService.js";
import { createStorageService } from "../storageService.js";
import { createTtsProvider } from "../tts/createTtsProvider.js";
import { VideoGenerationService } from "../videoGenerationService.js";
import { VideoPipeline } from "./videoPipeline.js";

export function createVideoPipeline(cfg: AppConfig): VideoPipeline {
  const storage = createStorageService(cfg);
  const tts = createTtsProvider(cfg);
  const images = createImageGenerator(cfg);
  const videoGen = new VideoGenerationService(cfg);
  return new VideoPipeline(cfg, storage, tts, images, videoGen);
}
