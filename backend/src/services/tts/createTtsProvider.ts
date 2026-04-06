import type { AppConfig } from "../../config/index.js";
import { MockTtsProvider } from "./mockTtsProvider.js";
import { OpenAiTtsProvider } from "./openAiTtsProvider.js";
import type { TtsProvider } from "./ttsTypes.js";

export function createTtsProvider(cfg: AppConfig): TtsProvider {
  if (cfg.ttsProvider === "openai") {
    return new OpenAiTtsProvider(cfg);
  }
  return new MockTtsProvider(cfg);
}
