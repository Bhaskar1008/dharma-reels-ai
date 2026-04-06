import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AppConfig } from "../../config/index.js";
import { probeDurationSec } from "../../utils/mediaProbe.js";
import { withRetry } from "../../utils/retry.js";
import type { TtsProvider, TtsResult, TtsSynthesizeOptions } from "./ttsTypes.js";

/** OpenAI speech API; use for real voice when API key is configured. */
export class OpenAiTtsProvider implements TtsProvider {
  readonly name = "openai";

  constructor(private readonly cfg: AppConfig) {}

  async synthesize(script: string, outBasePath: string, options?: TtsSynthesizeOptions): Promise<TtsResult> {
    const key = this.cfg.openai.apiKey.trim();
    if (!key) {
      throw new Error("OPENAI_API_KEY is required when TTS_PROVIDER=openai");
    }

    const voice = (options?.voice ?? this.cfg.openai.ttsVoice).trim() || "alloy";

    const audioPath = `${outBasePath}.mp3`;
    const speechUrl = `${this.cfg.openai.baseUrl.replace(/\/$/, "")}/audio/speech`;

    const body = JSON.stringify({
      model: this.cfg.openai.ttsModel,
      voice,
      input: script,
      format: "mp3",
    });

    await withRetry(
      async () => {
        const res = await fetch(speechUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`OpenAI TTS ${res.status}: ${text}`);
        }
        if (!res.body) throw new Error("OpenAI TTS: empty body");

        const nodeReadable = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
        await pipeline(nodeReadable, createWriteStream(audioPath));
      },
      { retries: 2, delayMs: 800, label: "OpenAI TTS" }
    );

    const durationSec = await probeDurationSec(this.cfg.ffprobePath, audioPath);
    return { audioPath, durationSec };
  }
}
