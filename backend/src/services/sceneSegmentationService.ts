/**
 * Splits narration into scenes for visuals + subtitles, targeting ~3–6s per scene.
 * Durations are estimates for weighting; final timing comes from TTS audio length.
 */

export interface SceneSegment {
  text: string;
  /** Estimated seconds (used as weight for proportional sync with real audio). */
  estimatedSeconds: number;
}

const MIN_SCENE_SEC = 3;
const MAX_SCENE_SEC = 6;
/** ~140 words/min narration pace for weighting. */
const WORDS_PER_MIN = 140;
const MAX_WORDS_PER_CHUNK = 12;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Speech length estimate in seconds (not clamped per scene). */
export function estimateSpeechSeconds(text: string): number {
  const w = wordCount(text);
  if (w === 0) return 0.5;
  return (w / WORDS_PER_MIN) * 60;
}

function clampSceneEstimate(sec: number): number {
  return Math.min(MAX_SCENE_SEC, Math.max(MIN_SCENE_SEC, Math.round(sec * 100) / 100));
}

/** Split long text into word chunks until each chunk is within max speech duration. */
function chunkByWords(text: string, maxWords: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    out.push(words.slice(i, i + maxWords).join(" "));
  }
  return out;
}

function splitLongSegment(text: string): string[] {
  const est = estimateSpeechSeconds(text);
  if (est <= MAX_SCENE_SEC) return [text];

  const byDelimiter = text.split(/[,;，；]/).map((s) => s.trim()).filter(Boolean);
  if (byDelimiter.length > 1) {
    return byDelimiter.flatMap(splitLongSegment);
  }

  return chunkByWords(text, MAX_WORDS_PER_CHUNK).flatMap((chunk) => {
    if (estimateSpeechSeconds(chunk) <= MAX_SCENE_SEC) return [chunk];
    return chunkByWords(chunk, Math.max(4, Math.floor(MAX_WORDS_PER_CHUNK / 2)));
  });
}

/** Primary split: Telugu/Latin sentence boundaries and line breaks. */
function splitByPunctuation(script: string): string[] {
  const normalized = script.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const parts = normalized
    .split(/[।॥\u0964\u0965.!?…]+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts;
}

function mergeShortScenes(segments: string[]): string[] {
  if (segments.length === 0) return [];
  const out: string[] = [];
  let cur = segments[0]!;

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]!;
    if (estimateSpeechSeconds(cur) < MIN_SCENE_SEC) {
      cur = `${cur} ${next}`.trim();
    } else {
      out.push(cur);
      cur = next;
    }
  }
  out.push(cur);

  if (out.length >= 2 && estimateSpeechSeconds(out[out.length - 1]!) < MIN_SCENE_SEC) {
    const last = out.pop()!;
    out[out.length - 1] = `${out[out.length - 1]!} ${last}`.trim();
  }

  return out;
}

/**
 * Turn a user script into weighted scenes.
 * Example (conceptual): long paragraph → multiple 3–6s scenes; fragments get merged.
 *
 * @example
 * // "రాముడు సీతను కలుసుకున్నాడు. లంకకు వెళ్లాలి! యుద్ధం తప్పదు"
 * // → ~3 segments at `.` / `!`, merged/split toward 3–6s estimates; final timings follow TTS via distributeSceneDurationsToAudio().
 */
export function segmentScenes(script: string): SceneSegment[] {
  const raw = splitByPunctuation(script);
  const expanded = raw.flatMap((r) => splitLongSegment(r));
  let merged = mergeShortScenes(expanded);
  merged = merged.flatMap((t) => splitLongSegment(t));
  merged = mergeShortScenes(merged);

  const scenes: SceneSegment[] = merged.map((text) => ({
    text,
    estimatedSeconds: clampSceneEstimate(estimateSpeechSeconds(text)),
  }));

  if (scenes.length === 0) {
    return [{ text: script.trim() || " ", estimatedSeconds: MIN_SCENE_SEC }];
  }

  return scenes;
}

/**
 * After TTS, assign each scene a duration so they sum to `audioDurationSec`.
 * Uses `estimatedSeconds` as proportional weights.
 */
export function distributeSceneDurationsToAudio(
  scenes: SceneSegment[],
  audioDurationSec: number
): { text: string; durationSec: number }[] {
  const weights = scenes.map((s) => Math.max(0.1, s.estimatedSeconds));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const total = Math.max(audioDurationSec, 0.1);

  const raw = weights.map((w) => (total * w) / sumW);
  const rounded = raw.map((x) => Math.round(x * 1000) / 1000);
  let drift = total - rounded.reduce((a, b) => a + b, 0);
  if (rounded.length > 0) {
    rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1]! + drift) * 1000) / 1000;
  }

  return scenes.map((s, i) => ({
    text: s.text,
    durationSec: rounded[i]!,
  }));
}
