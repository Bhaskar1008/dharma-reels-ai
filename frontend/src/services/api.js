import axios from "axios";

/** In Vite dev, default `/api` is proxied to the backend (same-origin video + download). */
const baseURL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "/api" : "http://localhost:3001");

export const api = axios.create({
  baseURL,
  timeout: 180_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * Start async video generation. Returns { id, status, message }.
 * @param {string} script
 * @param {object} [options]
 * @param {'male'|'female'} [options.voiceGender]
 * @param {boolean} [options.subtitlesEnabled]
 * @param {{ enabled: boolean, prompt?: string }} [options.backgroundMusic]
 */
export async function createVideo(script, options = {}) {
  const body = {
    script,
    ...(options.voiceGender ? { voiceGender: options.voiceGender } : {}),
    ...(typeof options.subtitlesEnabled === "boolean"
      ? { subtitlesEnabled: options.subtitlesEnabled }
      : {}),
    ...(options.backgroundMusic
      ? {
          backgroundMusic: {
            enabled: Boolean(options.backgroundMusic.enabled),
            ...(options.backgroundMusic.prompt?.trim()
              ? { prompt: options.backgroundMusic.prompt.trim().slice(0, 2000) }
              : {}),
          },
        }
      : {}),
  };
  const { data } = await api.post("/videos", body);
  return data;
}

/**
 * Poll job status. Returns { id, status, progress, meta, error, ... }.
 */
export async function getVideoStatus(jobId) {
  const { data } = await api.get(`/videos/${jobId}`);
  return data;
}

/**
 * Full URL to the MP4 stream. Use attachment for save-as; omit for `<video src>` (HTTP Range seeking).
 * @param {string} jobId
 * @param {{ attachment?: boolean }} [opts]
 */
export function getDownloadUrl(jobId, opts = {}) {
  const base = `${baseURL.replace(/\/$/, "")}/videos/${jobId}/download`;
  if (opts.attachment) {
    return `${base}${base.includes("?") ? "&" : "?"}attachment=1`;
  }
  return base;
}

/**
 * Trigger browser download of the MP4.
 */
export async function downloadVideo(jobId, filename = "dharma-reels-video.mp4") {
  const url = getDownloadUrl(jobId, { attachment: true });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
