import { existsSync } from "node:fs";
import path from "node:path";
import type { AppConfig } from "../config/index.js";
import { log } from "../utils/logger.js";
import { runCommand } from "../utils/exec.js";
import { withRetry } from "../utils/retry.js";

export interface MixAudioResult {
  /** Path to AAC file used for mux (voice-only or mixed). */
  outputPath: string;
  usedMusic: boolean;
}

/**
 * Mixes narration (full level) with looping background music at low gain.
 * On missing file or FFmpeg failure, returns the voice path only (caller skips mix).
 */
export async function mixVoiceWithBackgroundMusic(
  cfg: AppConfig,
  voicePath: string,
  outputMixedPath: string,
  durationSec: number,
  options?: { enabled?: boolean }
): Promise<MixAudioResult> {
  if (options?.enabled === false) {
    return { outputPath: voicePath, usedMusic: false };
  }

  const musicPath = cfg.bgmPath?.trim();
  if (!musicPath || !existsSync(musicPath)) {
    if (musicPath) {
      log.warn("Background music path not found; using voice only", { musicPath });
    }
    return { outputPath: voicePath, usedMusic: false };
  }

  const volVoice = cfg.bgmVoiceVolume;
  const volMusic = cfg.bgmMusicVolume;

  try {
    await withRetry(
      () =>
        runCommand(cfg.ffmpegPath, [
          "-y",
          "-i",
          path.resolve(voicePath),
          "-stream_loop",
          "-1",
          "-i",
          path.resolve(musicPath),
          "-filter_complex",
          `[0:a]volume=${volVoice}[v];[1:a]volume=${volMusic}[m];[v][m]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`,
          "-map",
          "[aout]",
          "-c:a",
          "aac",
          "-b:a",
          cfg.video.audioBitrate,
          "-t",
          String(durationSec),
          outputMixedPath,
        ]),
      { retries: 1, delayMs: 400, label: "ffmpeg audio mix" }
    );
    log.info("Mixed voice with background music", { outputMixedPath });
    return { outputPath: outputMixedPath, usedMusic: true };
  } catch (err) {
    log.error("Audio mix failed; using voice only", err);
    return { outputPath: voicePath, usedMusic: false };
  }
}
