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
 */
export async function createVideo(script) {
  const { data } = await api.post("/videos", { script });
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
 * Full URL to the downloadable MP4 (for opening in a new tab if needed).
 */
export function getDownloadUrl(jobId) {
  return `${baseURL.replace(/\/$/, "")}/videos/${jobId}/download`;
}

/**
 * Trigger browser download of the MP4.
 */
export async function downloadVideo(jobId, filename = "dharma-reels-video.mp4") {
  const url = getDownloadUrl(jobId);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
