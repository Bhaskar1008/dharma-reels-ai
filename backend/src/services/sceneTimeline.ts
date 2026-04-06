/**
 * If segmentation collapsed to one long scene, split into multiple timed slices
 * so we still generate several images across the video (reduces "one image + blank" feel).
 */
export function expandTimedScenesIfSingleLong(
  timed: { text: string; durationSec: number }[],
  maxParts: number
): { text: string; durationSec: number }[] {
  if (timed.length !== 1) return timed;
  const row = timed[0]!;
  const { text, durationSec } = row;
  if (durationSec < 12 || text.trim().length < 40) return timed;

  const parts = Math.min(maxParts, Math.max(2, Math.ceil(durationSec / 10)));
  const sliceLen = Math.max(1, Math.ceil(text.length / parts));
  const out: { text: string; durationSec: number }[] = [];
  const durEach = durationSec / parts;
  for (let i = 0; i < parts; i++) {
    const start = i * sliceLen;
    let chunk = text.slice(start, start + sliceLen).trim();
    if (!chunk) chunk = "…";
    out.push({ text: chunk, durationSec: durEach });
  }
  const drift = durationSec - out.reduce((a, x) => a + x.durationSec, 0);
  if (out.length > 0) {
    out[out.length - 1]!.durationSec = Math.round((out[out.length - 1]!.durationSec + drift) * 1000) / 1000;
  }
  return out;
}
