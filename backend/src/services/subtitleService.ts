import { writeFile } from "node:fs/promises";
import path from "node:path";

export interface TimedSubtitleScene {
  index: number;
  text: string;
  startSec: number;
  endSec: number;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

/** Formats seconds as SRT timestamps (HH:MM:SS,mmm). */
export function formatSrtTimestamp(sec: number): string {
  const msTotal = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(msTotal / 3600000);
  const m = Math.floor((msTotal % 3600000) / 60000);
  const s = Math.floor((msTotal % 60000) / 1000);
  const ms = msTotal % 1000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
}

/**
 * Builds cumulative subtitle blocks from per-scene durations (aligned with audio).
 */
export function buildTimedScenes(
  scenes: { text: string; durationSec: number }[]
): TimedSubtitleScene[] {
  let t = 0;
  return scenes.map((s, i) => {
    const start = t;
    const end = t + s.durationSec;
    t = end;
    return {
      index: i + 1,
      text: s.text.trim(),
      startSec: start,
      endSec: end,
    };
  });
}

export function buildSrtContent(timed: TimedSubtitleScene[]): string {
  const blocks = timed.map((b) => {
    const body = b.text.replace(/\r\n/g, "\n").split("\n").join("\n");
    return `${b.index}\n${formatSrtTimestamp(b.startSec)} --> ${formatSrtTimestamp(b.endSec)}\n${body}\n`;
  });
  return `${blocks.join("\n")}\n`;
}

export async function writeSrtFile(absPath: string, content: string): Promise<void> {
  await writeFile(absPath, content, { encoding: "utf8" });
}

export function defaultSrtPath(workDir: string): string {
  return path.join(workDir, "captions.srt");
}
