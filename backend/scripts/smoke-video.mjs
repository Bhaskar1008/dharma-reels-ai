/**
 * POST /videos with a short script, poll until terminal, list workdir files, ffprobe MP4.
 * Run from repo: `node backend/scripts/smoke-video.mjs` (API must be up on PORT or pass BASE_URL).
 */
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const base = process.env.BASE_URL || "http://localhost:3001";
const script =
  process.env.SMOKE_SCRIPT ||
  "Hello. This is scene two. And a third line for timing.";

async function main() {
  const post = await fetch(`${base}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });
  if (!post.ok) {
    console.error(await post.text());
    process.exit(1);
  }
  const created = await post.json();
  const id = created.id;
  if (!id) throw new Error("no job id");

  let last = null;
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await fetch(`${base}/videos/${id}`);
    last = await st.json();
    if (last.status === "completed" || last.status === "failed") break;
  }

  console.log("final status:", last?.status, last?.error || "");
  if (last?.status === "failed") {
    console.error(last);
    process.exit(1);
  }

  const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workDir = path.join(backendRoot, "storage", "output", id);
  const mp4 = path.join(backendRoot, "storage", "output", `${id}.mp4`);

  let files = [];
  try {
    files = await readdir(workDir);
  } catch {
    files = ["(workdir missing — may have been cleaned or job failed early)"];
  }

  const mp4Stat = await stat(mp4).catch(() => null);
  console.log("workdir:", workDir);
  console.log("files in workdir:", files);
  console.log("mp4:", mp4, "bytes:", mp4Stat?.size ?? "missing");

  const ffprobe =
    process.env.FFPROBE_PATH ||
    "ffprobe";
  if (mp4Stat && mp4Stat.size > 0) {
    try {
      const { stdout } = await execFileAsync(ffprobe, [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type,codec_name",
        "-of",
        "csv=p=0",
        mp4,
      ]);
      console.log("ffprobe streams:", stdout.trim());
    } catch (e) {
      console.warn("ffprobe failed:", e?.message || e);
    }
  }

  process.exit(last?.status === "completed" && mp4Stat && mp4Stat.size > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
