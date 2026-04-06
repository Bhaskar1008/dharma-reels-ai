export default function ScriptInput({
  value,
  onChange,
  voiceGender,
  onVoiceGenderChange,
  subtitlesEnabled,
  onSubtitlesEnabledChange,
  backgroundMusicEnabled,
  onBackgroundMusicEnabledChange,
  musicPrompt,
  onMusicPromptChange,
  onSubmit,
  disabled,
  busy,
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50">
      <h2 className="text-lg font-semibold text-slate-900">Script</h2>
      <p className="mt-1 text-sm text-slate-500">
        Paste Telugu narration. The backend will segment scenes, generate audio & visuals, then render your Short.
      </p>

      <label htmlFor="script" className="mt-4 block text-sm font-medium text-slate-700">
        Telugu script
      </label>
      <textarea
        id="script"
        rows={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter your Telugu script here..."
        className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
      />

      <fieldset className="mt-4 space-y-3">
        <legend className="text-sm font-medium text-slate-700">Voice</legend>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="radio"
              name="voiceGender"
              value="female"
              checked={voiceGender === "female"}
              onChange={() => onVoiceGenderChange("female")}
              disabled={disabled}
              className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Female (OpenAI: nova)
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="radio"
              name="voiceGender"
              value="male"
              checked={voiceGender === "male"}
              onChange={() => onVoiceGenderChange("male")}
              disabled={disabled}
              className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Male (OpenAI: onyx)
          </label>
        </div>
        <p className="text-xs text-slate-400">Uses OpenAI TTS when the server is configured with TTS_PROVIDER=openai.</p>
      </fieldset>

      <div className="mt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={subtitlesEnabled}
            onChange={(e) => onSubtitlesEnabledChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Burn subtitles into the video
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={backgroundMusicEnabled}
            onChange={(e) => onBackgroundMusicEnabledChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Background music
        </label>
        <p className="mt-1 text-xs text-slate-500">
          When enabled, the server mixes in the file from <code className="rounded bg-slate-200/80 px-1">BGM_PATH</code> if set.
          Optional prompt is stored for future AI music generation.
        </p>
        {backgroundMusicEnabled && (
          <label htmlFor="musicPrompt" className="mt-3 block text-sm font-medium text-slate-700">
            Music prompt <span className="font-normal text-slate-400">(optional)</span>
          </label>
        )}
        {backgroundMusicEnabled && (
          <textarea
            id="musicPrompt"
            rows={2}
            value={musicPrompt}
            onChange={(e) => onMusicPromptChange(e.target.value)}
            disabled={disabled}
            placeholder="e.g. calm devotional sitar, soft tabla…"
            className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
          />
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Starting…
            </>
          ) : (
            "Generate Video"
          )}
        </button>
      </div>
    </section>
  );
}

function Spinner({ className }) {
  return (
    <svg
      className={`animate-spin ${className || ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
