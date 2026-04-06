import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../config/index.js";
import { mixVoiceWithBackgroundMusic } from "../audioMixService.js";
import type { ImageGenerator } from "../imageGenerationService.js";
import { log } from "../../utils/logger.js";
import { probeDurationSec } from "../../utils/mediaProbe.js";
import { distributeSceneDurationsToAudio, segmentScenes } from "../sceneSegmentationService.js";
import { expandTimedScenesIfSingleLong } from "../sceneTimeline.js";
import type { StorageService } from "../storageService.js";
import { buildSrtContent, buildTimedScenes, defaultSrtPath, writeSrtFile } from "../subtitleService.js";
import type { TtsProvider } from "../tts/ttsTypes.js";
import type { VideoJobResult, VideoRequestOptions, VoiceGender } from "../../types/index.js";
import { buildUsageEstimate } from "../usageEstimate.js";
import { VideoGenerationService } from "../videoGenerationService.js";

export type ProgressCallback = (percent: number) => void | Promise<void>;
export type MetaPatchCallback = (patch: Record<string, unknown>) => void | Promise<void>;

function openAiVoiceForGender(gender?: VoiceGender): string | undefined {
  if (!gender) return undefined;
  return gender === "male" ? "onyx" : "nova";
}

/**
 * Phase 3 pipeline: segmentation → TTS → optional BGM mix → timed scenes → images → SRT →
 * FFmpeg (Ken Burns + fades + subs) → MP4. Returns metadata for job storage / Bull returnvalue.
 */
export class VideoPipeline {
  constructor(
    private readonly cfg: AppConfig,
    private readonly storage: StorageService,
    private readonly tts: TtsProvider,
    private readonly images: ImageGenerator,
    private readonly videoGen: VideoGenerationService
  ) {}

  async execute(
    jobId: string,
    script: string,
    options?: { onProgress?: ProgressCallback; onMetaPatch?: MetaPatchCallback; request?: VideoRequestOptions }
  ): Promise<VideoJobResult> {
    const onProgress = options?.onProgress;
    const onMetaPatch = options?.onMetaPatch;
    const request = options?.request;
    const burnSubtitles = request?.subtitlesEnabled !== false;
    const wantBgm = request?.backgroundMusic?.enabled === true;
    const musicPromptRequested = wantBgm && Boolean(request?.backgroundMusic?.prompt?.trim());

    const report = async (p: number) => {
      if (onProgress) await onProgress(p);
    };

    const patchMeta = async (patch: Record<string, unknown>) => {
      if (onMetaPatch) await onMetaPatch(patch);
    };

    const workDir = this.storage.getWorkDir(jobId);
    const outputPath = this.storage.getOutputVideoPath(jobId);

    await this.storage.ensureBaseDirs();
    await mkdir(workDir, { recursive: true });

    await report(5);

    const segmented = segmentScenes(script);
    log.info("Scenes segmented", { jobId, count: segmented.length });

    await report(12);
    const audioBase = path.join(workDir, "voice");
    const ttsVoice = openAiVoiceForGender(request?.voiceGender);
    const ttsResult = await this.tts.synthesize(script, audioBase, { voice: ttsVoice });
    if (this.tts.name === "mock") {
      log.info(
        "Mock TTS uses silent audio (placeholder). For spoken narration set TTS_PROVIDER=openai and OPENAI_API_KEY.",
        { jobId }
      );
    }

    const maxSec = this.cfg.video.maxDurationSec;

    let voiceDuration = ttsResult.durationSec;
    try {
      voiceDuration = await probeDurationSec(this.cfg.ffprobePath, ttsResult.audioPath);
    } catch (err) {
      log.warn("ffprobe audio duration failed; using TTS metadata", err);
    }
    voiceDuration = Math.min(voiceDuration, maxSec);

    await report(28);
    const mixedPath = path.join(workDir, "mixed.m4a");
    const mix = await mixVoiceWithBackgroundMusic(
      this.cfg,
      ttsResult.audioPath,
      mixedPath,
      voiceDuration,
      { enabled: wantBgm }
    );
    const finalAudioPath = mix.outputPath;

    let muxDurationSec = voiceDuration;
    try {
      muxDurationSec = await probeDurationSec(this.cfg.ffprobePath, finalAudioPath);
    } catch (err) {
      log.warn("ffprobe final narration file failed; using voice duration", err);
    }
    muxDurationSec = Math.min(muxDurationSec, maxSec);

    let timed = distributeSceneDurationsToAudio(segmented, muxDurationSec);
    timed = expandTimedScenesIfSingleLong(timed, 8);

    const usagePreview = buildUsageEstimate({
      scriptLengthChars: script.length,
      sceneCount: timed.length,
      ttsProvider: this.tts.name,
      imageProvider: this.images.name,
      musicPromptRequested,
    });
    await patchMeta({ usageEstimate: usagePreview });

    await report(40);
    const slideshowScenes: { imagePath: string; durationSec: number }[] = [];
    for (let i = 0; i < timed.length; i++) {
      const scene = timed[i]!;
      const imgPath = path.join(workDir, `scene-${String(i).padStart(2, "0")}.png`);
      const generated = await this.images.generateSceneImage({ text: scene.text, index: i }, imgPath);
      slideshowScenes.push({ imagePath: generated.path, durationSec: scene.durationSec });
      await report(40 + Math.floor((20 * (i + 1)) / Math.max(1, timed.length)));
    }

    const timedSubs = buildTimedScenes(timed);
    const srtPath = defaultSrtPath(workDir);
    if (burnSubtitles) {
      await writeSrtFile(srtPath, buildSrtContent(timedSubs));
    }

    await report(72);
    await this.videoGen.assertAudioMatchesScenes(finalAudioPath, slideshowScenes);

    log.info("Final video encode started (progress may advance slowly; this step is CPU-heavy)", {
      jobId,
      scenes: slideshowScenes.length,
    });

    let encodePct = 72;
    const encodeTicker = setInterval(() => {
      encodePct = Math.min(90, encodePct + 1);
      void report(encodePct);
    }, 2500);

    try {
      await this.videoGen.renderSlideshowWithSubtitles({
        scenes: slideshowScenes,
        audioPath: finalAudioPath,
        srtPath,
        outputPath,
        muxDurationSec,
        burnSubtitles,
      });
    } finally {
      clearInterval(encodeTicker);
    }

    await report(92);
    if (this.cfg.cleanupJobWorkDir) {
      await this.videoGen.cleanupWorkDir(workDir);
    } else {
      log.info("Kept job workdir (VIDEO_CLEANUP_WORKDIR=false)", workDir);
    }

    await report(100);

    const usageEstimate = buildUsageEstimate({
      scriptLengthChars: script.length,
      sceneCount: timed.length,
      ttsProvider: this.tts.name,
      imageProvider: this.images.name,
      musicPromptRequested,
    });

    const meta: Record<string, unknown> = {
      phase: 3,
      ttsProvider: this.tts.name,
      imageProvider: this.images.name,
      sceneCount: timed.length,
      durationSec: muxDurationSec,
      usedBackgroundMusic: mix.usedMusic,
      burnSubtitles,
      voiceGender: request?.voiceGender ?? null,
      ttsVoiceId: ttsVoice ?? null,
      backgroundMusicEnabled: wantBgm,
      backgroundMusicPrompt: request?.backgroundMusic?.prompt?.trim() || null,
      usageEstimate,
      approximateTotalTokens: usageEstimate.approximateTotalTokens,
      estimatedTotalUsd: usageEstimate.estimatedTotalUsd,
      scenesPreview: timed.slice(0, 8).map((s) => ({
        durationSec: s.durationSec,
        text: s.text.length > 200 ? `${s.text.slice(0, 200)}…` : s.text,
      })),
    };

    return { outputPath, meta };
  }
}
