/**
 * Approximate OpenAI pricing (USD) — adjust when list prices change.
 * TTS: https://openai.com/pricing  (tts-1 ≈ $15 / 1M chars)
 * Images: DALL·E 3 standard 1024×1792 ≈ $0.08 / image (varies by tier)
 */
const TTS_USD_PER_CHAR = 15 / 1_000_000;
const DALLE_3_1024_1792_USD = 0.08;

export interface UsageBreakdown {
  tts: {
    provider: string;
    characters: number;
    estimatedTokens: number;
    estimatedUsd: number;
  };
  images: {
    provider: string;
    count: number;
    estimatedTokens: number;
    estimatedUsd: number;
  };
  music?: {
    note: string;
  };
  /** Rough token-equivalent for UI (not from API billing). */
  approximateTotalTokens: number;
  estimatedTotalUsd: number;
}

export function buildUsageEstimate(input: {
  scriptLengthChars: number;
  sceneCount: number;
  ttsProvider: string;
  imageProvider: string;
  musicPromptRequested?: boolean;
}): UsageBreakdown {
  const ttsChars = input.scriptLengthChars;
  const ttsTokens = Math.max(1, Math.ceil(ttsChars / 4));
  const ttsUsd =
    input.ttsProvider === "openai" ? ttsChars * TTS_USD_PER_CHAR : 0;

  const imgCount = input.sceneCount;
  const imgTokens = imgCount * 1000;
  const imgUsd =
    input.imageProvider === "openai-images" ? imgCount * DALLE_3_1024_1792_USD : 0;

  const approxTotalTokens = ttsTokens + imgTokens;
  const estimatedTotalUsd = ttsUsd + imgUsd;

  const music =
    input.musicPromptRequested === true
      ? {
          note:
            "Music generation from a prompt is not wired to an API yet; use BGM_PATH on the server for a static track.",
        }
      : undefined;

  return {
    tts: {
      provider: input.ttsProvider,
      characters: ttsChars,
      estimatedTokens: ttsTokens,
      estimatedUsd: Math.round(ttsUsd * 1_000_000) / 1_000_000,
    },
    images: {
      provider: input.imageProvider,
      count: imgCount,
      estimatedTokens: imgTokens,
      estimatedUsd: Math.round(imgUsd * 1_000_000) / 1_000_000,
    },
    music,
    approximateTotalTokens: approxTotalTokens,
    estimatedTotalUsd: Math.round(estimatedTotalUsd * 1_000_000) / 1_000_000,
  };
}
