import type { AppConfig } from "../../config/index.js";
import { estimateSpeechSeconds, segmentScenes } from "../sceneSegmentationService.js";
import { probeDurationSec } from "../../utils/mediaProbe.js";
import { runCommand } from "../../utils/exec.js";
import { withRetry } from "../../utils/retry.js";
import type { TtsProvider, TtsResult } from "./ttsTypes.js";

/**
 * Phase 1 mock TTS: generates a silent AAC track whose length scales with script size.
 * Replace with a real provider via TTS_PROVIDER without changing the pipeline.
 */
export class MockTtsProvider implements TtsProvider {
  readonly name = "mock";

  constructor(private readonly cfg: AppConfig) {}

  /**
   * Same speech-length model as scene segmentation (Indic-friendly), so mock audio length
   * matches how scene durations are weighted. Capped by `VIDEO_MAX_DURATION_SEC`.
   */
  private estimateDurationSec(script: string): number {
    const maxSec = this.cfg.video.maxDurationSec;
    const trimmed = script.trim();
    if (!trimmed) return Math.min(3, maxSec);
    const scenes = segmentScenes(trimmed);
    let sec = scenes.reduce((acc, s) => acc + estimateSpeechSeconds(s.text), 0);
    if (!Number.isFinite(sec) || sec <= 0) sec = 1;
    const bounded = Math.min(maxSec, Math.max(1, sec));
    return Math.round(bounded * 10) / 10;
  }

  async synthesize(script: string, outBasePath: string): Promise<TtsResult> {
    const durationSec = this.estimateDurationSec(script);
    const audioPath = `${outBasePath}.m4a`;

    await withRetry(
      () =>
        runCommand(this.cfg.ffmpegPath, [
          "-y",
          "-f",
          "lavfi",
          "-i",
          `anullsrc=r=44100:cl=mono`,
          "-t",
          String(durationSec),
          "-c:a",
          "aac",
          "-b:a",
          this.cfg.video.audioBitrate,
          audioPath,
        ]),
      { retries: 2, delayMs: 400, label: "mock TTS (ffmpeg silence)" }
    );

    const measured = await probeDurationSec(this.cfg.ffprobePath, audioPath);
    return { audioPath, durationSec: measured };
  }
}
