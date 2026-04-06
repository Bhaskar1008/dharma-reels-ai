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

/** OpenAI may return JPEG or PNG bytes; wrong extension breaks FFmpeg decoding (black video). */
function imagePathForBytes(outPath: string, buf: Buffer): string {
  const isJpeg = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp =
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50;
  let ext = ".png";
  if (isJpeg) ext = ".jpg";
  else if (isWebp) ext = ".webp";
  else if (isPng) ext = ".png";
  const withoutExt = outPath.replace(/\.(png|jpe?g|webp)$/i, "");
  return `${withoutExt}${ext}`;
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

    let savedPath = outPath;
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
          const writePath = imagePathForBytes(outPath, buf);
          await mkdir(path.dirname(writePath), { recursive: true });
          await writeFile(writePath, buf);
          savedPath = writePath;
        },
        { retries: 2, delayMs: 1200, label: `OpenAI image scene ${scene.index}` }
      );

      log.info("Generated image for scene", scene.index);
      return { path: savedPath, usedFallback: false, provider: this.name };
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
