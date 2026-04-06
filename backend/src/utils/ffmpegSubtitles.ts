import path from "node:path";

/**
 * Builds a subtitles filter value for FFmpeg's -vf on Windows paths with spaces/colons.
 * Uses forward slashes and escapes the Windows drive colon.
 *
 * Prefer {@link buildSubtitlesFilterBasename} when FFmpeg is run with `cwd` set to the
 * directory containing the SRT — absolute paths break the subtitles filter on Windows because
 * `:` after a drive letter is parsed as a filter option separator.
 */
export function buildSubtitlesFilterValue(srtAbsPath: string): string {
  let p = path.resolve(srtAbsPath).replace(/\\/g, "/");
  p = p.replace(/^([A-Za-z]):/, "$1\\:");
  const escaped = p.replace(/'/g, "'\\''");
  return `subtitles=filename='${escaped}':charenc=UTF-8`;
}

/**
 * Use with `runCommand(..., { cwd: dirContainingSrt })` so the path has no `C:` colon.
 */
export function buildSubtitlesFilterBasename(srtPath: string): string {
  const base = path.basename(path.resolve(srtPath));
  const escaped = base.replace(/'/g, "'\\''");
  return `subtitles=filename='${escaped}':charenc=UTF-8`;
}
