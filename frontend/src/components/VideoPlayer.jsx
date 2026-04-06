import { useEffect } from "react";

export default function VideoPlayer({ videoUrl, onDownload, downloadBusy }) {
  useEffect(() => {
    return () => {
      if (videoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  if (!videoUrl) return null;

  return (
    <section
      id="video-preview-section"
      className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50"
    >
      <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
      <p className="mt-1 text-sm text-slate-500">Your 9:16 video is ready. Play below or download the MP4.</p>

      <div className="mt-4 overflow-hidden rounded-xl bg-black shadow-inner">
        <video
          className="mx-auto max-h-[70vh] w-full object-contain"
          controls
          playsInline
          src={videoUrl}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={downloadBusy}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {downloadBusy ? "Preparing…" : "Download Video"}
        </button>
      </div>
    </section>
  );
}
