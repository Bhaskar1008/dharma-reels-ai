import { rm } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/index.js";
import { buildSubtitlesFilterBasename } from "../utils/ffmpegSubtitles.js";
import { log } from "../utils/logger.js";
import { probeDurationSec } from "../utils/mediaProbe.js";
import { runCommand } from "../utils/exec.js";
import { withRetry } from "../utils/retry.js";
import {
  buildConcatAndSubtitlesFilter,
  buildConcatVideoOnly,
  buildSceneVideoFilterChain,
} from "./transitionService.js";

export interface SlideshowSceneInput {
  imagePath: string;
  durationSec: number;
}

export interface RenderSlideshowInput {
  scenes: SlideshowSceneInput[];
  audioPath: string;
  srtPath: string;
  outputPath: string;
  /** Final mux duration (seconds), must match narration audio — prevents a long blank tail if video runs longer than audio. */
  muxDurationSec: number;
  burnSubtitles: boolean;
}

/**
 * FFmpeg: Ken Burns + fades per scene → concat → burn subtitles → H.264 + AAC.
 */
export class VideoGenerationService {
  constructor(private readonly cfg: AppConfig) {}

  async assertAudioMatchesScenes(audioPath: string, scenes: SlideshowSceneInput[]): Promise<void> {
    const audioSec = await probeDurationSec(this.cfg.ffprobePath, audioPath);
    const sum = scenes.reduce((a, s) => a + s.durationSec, 0);
    const drift = Math.abs(audioSec - sum);
    if (drift > 0.25) {
      log.warn("Audio vs scene duration drift (seconds)", { audioSec, sumScenes: sum, drift });
    }
  }

  async renderSlideshowWithSubtitles(input: RenderSlideshowInput): Promise<void> {
    const { width, height, fps, audioBitrate, crf, preset } = this.cfg.video;
    const n = input.scenes.length;
    if (n === 0) throw new Error("no scenes to render");

    const workDir = path.dirname(path.resolve(input.srtPath));
    const relFromWork = (filePath: string): string => {
      const rel = path.relative(workDir, path.resolve(filePath));
      if (!rel || rel === ".") {
        throw new Error(`ffmpeg paths: could not relativize ${filePath} under ${workDir}`);
      }
      return rel.split(path.sep).join("/");
    };

    const fcParts: string[] = [];
    for (let i = 0; i < n; i++) {
      fcParts.push(
        buildSceneVideoFilterChain(i, { durationSec: input.scenes[i]!.durationSec }, this.cfg)
      );
    }

    if (input.burnSubtitles) {
      const subBody = buildSubtitlesFilterBasename(input.srtPath);
      fcParts.push(buildConcatAndSubtitlesFilter(n, subBody));
    } else {
      fcParts.push(buildConcatVideoOnly(n));
    }

    const filterComplex = fcParts.join(";");

    const args: string[] = ["-y"];
    for (let i = 0; i < n; i++) {
      const s = input.scenes[i]!;
      // Do not force -f image2: OpenAI (and fallbacks) may be PNG/JPEG; wrong demuxer yields black frames.
      args.push(
        "-loop",
        "1",
        "-framerate",
        String(fps),
        "-t",
        String(s.durationSec),
        "-i",
        relFromWork(s.imagePath)
      );
    }
    const audioIndex = n;
    const audioRel = relFromWork(input.audioPath);
    const isMp3 = audioRel.toLowerCase().endsWith(".mp3");
    if (isMp3) {
      args.push("-f", "mp3", "-i", audioRel);
    } else {
      args.push("-i", audioRel);
    }
    args.push(
      "-filter_complex",
      filterComplex,
      "-map",
      "[outv]",
      "-map",
      `${audioIndex}:a:0`,
      "-c:v",
      "libx264",
      "-preset",
      preset,
      "-crf",
      String(crf),
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      audioBitrate,
      "-movflags",
      "+faststart",
      "-t",
      String(Math.max(0.1, input.muxDurationSec)),
      relFromWork(input.outputPath)
    );

    log.info("Rendering slideshow (transitions + subs)", { scenes: n, output: input.outputPath, cwd: workDir });

    await withRetry(() => runCommand(this.cfg.ffmpegPath, args, { cwd: workDir }), {
      retries: 1,
      delayMs: 600,
      label: "ffmpeg slideshow+subs+transitions",
    });
  }

  async cleanupWorkDir(workDir: string): Promise<void> {
    try {
      await rm(workDir, { recursive: true, force: true });
      log.info("Cleaned work directory", workDir);
    } catch (err) {
      log.warn("Work directory cleanup failed", err);
    }
  }
}
