import type { BackgroundMusicRequest, VideoRequestOptions, VoiceGender } from "../types/index.js";

export function parseVideoRequest(body: unknown): VideoRequestOptions {
  if (!body || typeof body !== "object") {
    return {};
  }
  const b = body as Record<string, unknown>;

  let voiceGender: VoiceGender | undefined;
  if (b.voiceGender === "male" || b.voiceGender === "female") {
    voiceGender = b.voiceGender;
  }

  let subtitlesEnabled = true;
  if (typeof b.subtitlesEnabled === "boolean") {
    subtitlesEnabled = b.subtitlesEnabled;
  }

  let backgroundMusic: BackgroundMusicRequest | undefined;
  if (b.backgroundMusic && typeof b.backgroundMusic === "object") {
    const m = b.backgroundMusic as Record<string, unknown>;
    const enabled = m.enabled === true;
    const prompt =
      typeof m.prompt === "string" && m.prompt.trim() ? m.prompt.trim().slice(0, 2000) : undefined;
    backgroundMusic = { enabled, ...(prompt ? { prompt } : {}) };
  }

  return { voiceGender, subtitlesEnabled, backgroundMusic };
}
