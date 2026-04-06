import UsageMetrics from "./UsageMetrics.jsx";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800 ring-amber-600/20",
  processing: "bg-indigo-100 text-indigo-800 ring-indigo-600/20",
  completed: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  failed: "bg-rose-100 text-rose-800 ring-rose-600/20",
};

export default function StatusTracker({ status, progress, error, jobId, polling, meta }) {
  if (!jobId) return null;

  const pct =
    typeof progress === "number" ? Math.min(100, Math.max(0, progress)) : status === "completed" ? 100 : 0;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50">
      <h2 className="text-lg font-semibold text-slate-900">Job status</h2>
      <p className="mt-1 font-mono text-xs text-slate-400 break-all">ID: {jobId}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
            STATUS_STYLES[status] || "bg-slate-100 text-slate-700 ring-slate-600/20"
          }`}
        >
          {status || "unknown"}
        </span>
        {polling && (status === "pending" || status === "processing") && (
          <span className="flex items-center text-sm text-slate-500">
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            Updating…
          </span>
        )}
      </div>

      {(status === "processing" || status === "pending") && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1 text-rose-700">{error}</p>
        </div>
      )}

      <UsageMetrics meta={meta} />
    </section>
  );
}
