/**
 * Shows approximate token usage and USD estimate from job.meta.usageEstimate (backend).
 */
export default function UsageMetrics({ meta }) {
  const u = meta?.usageEstimate;
  if (!u || typeof u !== "object") return null;

  const totalTok = u.approximateTotalTokens;
  const totalUsd = u.estimatedTotalUsd;
  const tts = u.tts;
  const images = u.images;

  return (
    <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">Usage &amp; estimate</p>
      <p className="mt-1 text-xs text-slate-500">
        Approximate figures for TTS + image generation (not live API billing).
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">Approx. total tokens</dt>
          <dd className="font-mono text-base font-semibold text-slate-900">
            {typeof totalTok === "number" ? totalTok.toLocaleString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Est. cost (USD)</dt>
          <dd className="font-mono text-base font-semibold text-slate-900">
            {typeof totalUsd === "number" ? `$${totalUsd.toFixed(4)}` : "—"}
          </dd>
        </div>
        {tts && typeof tts === "object" && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500">TTS ({tts.provider})</dt>
            <dd className="mt-0.5 text-xs text-slate-600">
              ~{typeof tts.estimatedTokens === "number" ? tts.estimatedTokens.toLocaleString() : "—"} tokens · $
              {typeof tts.estimatedUsd === "number" ? tts.estimatedUsd.toFixed(6) : "—"} · {tts.characters} chars
            </dd>
          </div>
        )}
        {images && typeof images === "object" && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500">Images ({images.provider})</dt>
            <dd className="mt-0.5 text-xs text-slate-600">
              {images.count} scenes · ~{typeof images.estimatedTokens === "number" ? images.estimatedTokens.toLocaleString() : "—"}{" "}
              tokens · ${typeof images.estimatedUsd === "number" ? images.estimatedUsd.toFixed(4) : "—"}
            </dd>
          </div>
        )}
        {u.music?.note && (
          <div className="sm:col-span-2 rounded-lg bg-amber-50/80 px-2 py-1.5 text-xs text-amber-900">
            {u.music.note}
          </div>
        )}
      </dl>
    </div>
  );
}
