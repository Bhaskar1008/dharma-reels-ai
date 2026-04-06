import { existsSync } from "node:fs";
import path from "node:path";
import type { AppConfig } from "../../config/index.js";
import { runCommand } from "../../utils/exec.js";

const FILE = "placeholder-vertical.png";

/** Ensures a 1080x1920 placeholder exists under assets dir (generated once via FFmpeg). */
export async function ensurePlaceholderImage(cfg: AppConfig): Promise<string> {
  const out = path.join(cfg.assetsDir, FILE);
  if (existsSync(out)) return out;

  await runCommand(cfg.ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x16213e:s=${cfg.video.width}x${cfg.video.height}:d=1`,
    "-frames:v",
    "1",
    out,
  ]);

  return out;
}
