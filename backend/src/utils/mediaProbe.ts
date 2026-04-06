import { runCommand } from "./exec.js";

export async function probeDurationSec(ffprobe: string, mediaPath: string): Promise<number> {
  const { stdout } = await runCommand(ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    mediaPath,
  ]);
  const n = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`ffprobe: invalid duration for ${mediaPath}`);
  }
  return Math.round(n * 100) / 100;
}
