import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/index.js";
import { log } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import { ensurePlaceholderImage } from "./video/placeholderImage.js";

export interface ImageSceneInput {
  text: string;
  index: number;
}

export interface GeneratedSceneImage {
  path: string;
  usedFallback: boolean;
  provider: string;
}

export interface ImageGenerator {
  readonly name: string;
  generateSceneImage(scene: ImageSceneInput, outPath: string): Promise<GeneratedSceneImage>;
}

function buildImagePrompt(sceneText: string): string {
  const excerpt = sceneText.trim().slice(0, 400);
  return [
    "Epic Mahabharata style cinematic scene, dramatic volumetric lighting,",
    "Telugu mythology atmosphere, ultra-detailed, 9:16 vertical composition,",
    "no text, no watermark, painterly realism.",
    `Scene: ${excerpt}`,
  ].join(" ");
}

/** Copies the shared vertical placeholder for each scene (Phase 2 stub). */
export class MockImageGenerator implements ImageGenerator {
  readonly name = "mock";

  constructor(private readonly cfg: AppConfig) {}

  async generateSceneImage(_scene: ImageSceneInput, outPath: string): Promise<GeneratedSceneImage> {
    const placeholder = await ensurePlaceholderImage(this.cfg);
    await mkdir(path.dirname(outPath), { recursive: true });
    await copyFile(placeholder, outPath);
    return { path: outPath, usedFallback: true, provider: this.name };
  }
}

/** OpenAI Images API (DALL·E 3); falls back to placeholder on failure. */
export class OpenAiImageGenerator implements ImageGenerator {
  readonly name = "openai-images";

  constructor(private readonly cfg: AppConfig) {}

  async generateSceneImage(scene: ImageSceneInput, outPath: string): Promise<GeneratedSceneImage> {
    const key = this.cfg.openai.apiKey.trim();
    if (!key) {
      log.warn("OPENAI_API_KEY missing; using placeholder for scene", scene.index);
      return new MockImageGenerator(this.cfg).generateSceneImage(scene, outPath);
    }

    const url = `${this.cfg.openai.baseUrl.replace(/\/$/, "")}/images/generations`;
    const prompt = buildImagePrompt(scene.text);

    try {
      await withRetry(
        async () => {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: this.cfg.openai.imageModel,
              prompt,
              n: 1,
              size: this.cfg.openai.imageSize,
              response_format: "url",
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenAI images ${res.status}: ${text}`);
          }
          const data = (await res.json()) as { data?: { url?: string }[] };
          const imageUrl = data.data?.[0]?.url;
          if (!imageUrl) throw new Error("OpenAI images: no url in response");

          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) {
            throw new Error(`Image download ${imgRes.status}`);
          }
          const buf = Buffer.from(await imgRes.arrayBuffer());
          await mkdir(path.dirname(outPath), { recursive: true });
          await writeFile(outPath, buf);
        },
        { retries: 2, delayMs: 1200, label: `OpenAI image scene ${scene.index}` }
      );

      log.info("Generated image for scene", scene.index);
      return { path: outPath, usedFallback: false, provider: this.name };
    } catch (err) {
      log.error("Image generation failed; using placeholder", err);
      return new MockImageGenerator(this.cfg).generateSceneImage(scene, outPath);
    }
  }
}

export function createImageGenerator(cfg: AppConfig): ImageGenerator {
  if (cfg.imageProvider === "openai") {
    return new OpenAiImageGenerator(cfg);
  }
  return new MockImageGenerator(cfg);
}
