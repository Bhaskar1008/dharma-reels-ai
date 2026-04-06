import type { AppConfig } from "../../config/index.js";
import { runCommand } from "../../utils/exec.js";
import { withRetry } from "../../utils/retry.js";

export interface RenderVerticalVideoInput {
  imagePath: string;
  audioPath: string;
  outputPath: string;
}

/**
 * Burns a still image over full audio length, scaled/padded to 9:16 for Shorts.
 * Video codec: H.264 + AAC in MP4.
 */
export class FfmpegRenderer {
  constructor(private readonly cfg: AppConfig) {}

  async renderVerticalMp4(input: RenderVerticalVideoInput): Promise<void> {
    const { width, height, fps, audioBitrate } = this.cfg.video;
    const vf = [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    ].join(",");

    await withRetry(
      () =>
        runCommand(this.cfg.ffmpegPath, [
          "-y",
          "-loop",
          "1",
          "-i",
          input.imagePath,
          "-i",
          input.audioPath,
          "-vf",
          vf,
          "-r",
          String(fps),
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          audioBitrate,
          "-shortest",
          input.outputPath,
        ]),
      { retries: 2, delayMs: 500, label: "ffmpeg render" }
    );
  }
}
