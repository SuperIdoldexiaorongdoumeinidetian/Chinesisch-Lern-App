// Lautsprecher-Button, der ein Hanzi auf Mandarin vorliest.
// Ist keine chinesische Stimme installiert, wird der Button ausgegraut und
// (optional) ein dezenter Hinweis angezeigt. Die App funktioniert ohne Audio
// uneingeschränkt weiter.
export default function SpeakButton({ text, speech, showHint = false }) {
  const { speak, available, loading } = speech;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        // Klick-Bubbling stoppen, damit das Klicken auf den Button nicht
        // versehentlich die Karte auf-/zudeckt.
        onClick={(e) => {
          e.stopPropagation();
          speak(text);
        }}
        disabled={!available}
        aria-label="Aussprache anhören"
        title={available ? "Aussprache anhören" : "Keine chinesische Stimme installiert"}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors ${
          available
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
            : "cursor-not-allowed bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600"
        }`}
      >
        🔊
      </button>
      {showHint && !available && !loading && (
        <span className="text-xs text-zinc-400">
          Keine chinesische Stimme installiert — unter iOS-Einstellungen &gt;
          Bedienungshilfen &gt; Gesprochene Inhalte hinzufügbar.
        </span>
      )}
    </span>
  );
}
