import type { AppConfig } from "../config/index.js";

export interface SceneTiming {
  durationSec: number;
}

/**
 * Per-scene: overscale → Ken Burns (zoompan) → fades → yuv420p labels for concat.
 */
export function buildSceneVideoFilterChain(
  inputIndex: number,
  scene: SceneTiming,
  cfg: AppConfig
): string {
  const { width: w, height: h, fps } = cfg.video;
  const fadeSec = cfg.transition.fadeSec;
  const zoomStep = cfg.transition.kenBurnsZoomStep;
  const D = Math.max(0.1, scene.durationSec);
  const frames = Math.max(2, Math.round(D * fps));

  let fadeIn = Math.min(fadeSec, D / 3);
  let fadeOut = Math.min(fadeSec, D / 3);
  // When scenes are very short, overlapping fades can hide the whole clip (looks like a black video).
  const fadeSum = fadeIn + fadeOut;
  if (fadeSum > D * 0.92) {
    const scale = (D * 0.92) / fadeSum;
    fadeIn *= scale;
    fadeOut *= scale;
  }
  const fadeOutStart = Math.max(0, D - fadeOut);

  const ow = Math.round(w * 1.18);
  const oh = Math.round(h * 1.18);

  const scale = `scale=${ow}:${oh}`;
  const zoompan = `zoompan=z='min(zoom+${zoomStep},1.18)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=${fps}`;
  const fades = `fade=t=in:st=0:d=${fadeIn},fade=t=out:st=${fadeOutStart}:d=${fadeOut}`;

  // setpts: still images often have no/incorrect PTS; zoompan can output black without this.
  return `[${inputIndex}:v]setpts=PTS-STARTPTS,${scale},${zoompan},format=yuv420p,${fades}[v${inputIndex}]`;
}

/** subtitleBody: output of buildSubtitlesFilterBasename / buildSubtitlesFilterValue. */
export function buildConcatAndSubtitlesFilter(sceneCount: number, subtitleBody: string): string {
  const labels = Array.from({ length: sceneCount }, (_, i) => `[v${i}]`).join("");
  const concat = `${labels}concat=n=${sceneCount}:v=1:a=0:unsafe=1[vc]`;
  return `${concat};[vc]${subtitleBody}[outv]`;
}

/** Video only after per-scene chains (no subtitles). */
export function buildConcatVideoOnly(sceneCount: number): string {
  const labels = Array.from({ length: sceneCount }, (_, i) => `[v${i}]`).join("");
  return `${labels}concat=n=${sceneCount}:v=1:a=0:unsafe=1[vc];[vc]format=yuv420p[outv]`;
}
