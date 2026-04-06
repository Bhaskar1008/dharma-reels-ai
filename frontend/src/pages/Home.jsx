import { useCallback, useEffect, useRef, useState } from "react";
import ScriptInput from "../components/ScriptInput.jsx";
import StatusTracker from "../components/StatusTracker.jsx";
import VideoPlayer from "../components/VideoPlayer.jsx";
import { createVideo, downloadVideo, getDownloadUrl, getVideoStatus } from "../services/api.js";

const POLL_MS = 4000;
const TERMINAL = new Set(["completed", "failed"]);

export default function Home() {
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState("default");
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const previewRef = useRef(null);
  const previewLoadedForJob = useRef(null);

  const scrollToPreview = useCallback(() => {
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const loadPreview = useCallback(
    (id) => {
      setVideoUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return getDownloadUrl(id);
      });
      setTimeout(scrollToPreview, 120);
    },
    [scrollToPreview]
  );

  useEffect(() => {
    if (!jobId) return undefined;

    let cancelled = false;
    let intervalId;
    previewLoadedForJob.current = null;

    setPolling(true);

    const poll = async () => {
      try {
        const data = await getVideoStatus(jobId);
        if (cancelled) return;

        setStatus(data.status);
        setProgress(typeof data.progress === "number" ? data.progress : 0);
        if (data.error) setError(data.error);

        if (data.status === "completed" && previewLoadedForJob.current !== jobId) {
          previewLoadedForJob.current = jobId;
          loadPreview(jobId);
        }

        if (TERMINAL.has(data.status)) {
          setPolling(false);
          if (intervalId) clearInterval(intervalId);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e?.response?.data?.error || e?.message || "Failed to fetch status.";
        setApiError(msg);
        setPolling(false);
        if (intervalId) clearInterval(intervalId);
      }
    };

    void poll();
    intervalId = setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, loadPreview]);

  const handleGenerate = async () => {
    setApiError(null);
    setError(null);
    previewLoadedForJob.current = null;
    setVideoUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setJobId(null);
    setStatus(null);
    setProgress(0);
    setStarting(true);
    try {
      const data = await createVideo(script.trim());
      setJobId(data.id);
      setStatus(data.status || "pending");
      setProgress(0);
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.message || "Could not start video generation.";
      setApiError(msg);
    } finally {
      setStarting(false);
    }
  };

  const processing = Boolean(jobId && status && !TERMINAL.has(status));

  const handleDownload = async () => {
    if (!jobId) return;
    setDownloadBusy(true);
    setApiError(null);
    try {
      await downloadVideo(jobId, `dharma-reels-${jobId.slice(0, 8)}.mp4`);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Download failed.";
      setApiError(msg);
    } finally {
      setDownloadBusy(false);
    }
  };

  const showVideo = status === "completed" && videoUrl;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/90">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">DharmaReels AI</h1>
            <p className="text-sm text-slate-500">Telugu script → cinematic Shorts</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        {apiError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {apiError}
          </div>
        )}

        <ScriptInput
          value={script}
          onChange={setScript}
          voice={voice}
          onVoiceChange={setVoice}
          onSubmit={handleGenerate}
          disabled={starting || processing}
          busy={starting}
        />

        <StatusTracker
          status={status}
          progress={progress}
          error={error}
          jobId={jobId}
          polling={polling}
        />

        <div ref={previewRef}>
          {showVideo && (
            <VideoPlayer videoUrl={videoUrl} onDownload={handleDownload} downloadBusy={downloadBusy} />
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-400">
        Phase 4 UI · API {import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"}
      </footer>
    </div>
  );
}
