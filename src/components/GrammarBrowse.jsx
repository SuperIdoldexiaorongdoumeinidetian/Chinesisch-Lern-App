// Nachschlagen: alle 48 Grammatikthemen, gruppiert nach Lektion, mit Suche.
// Detailansicht zeigt Struktur, Erklärung und alle Beispielsätze: das 汉字 immer,
// Pinyin + deutsche Übersetzung aber verdeckt („Spoiler“). Sie werden nur
// aufgedeckt, wenn man die Karte überfährt (Desktop-Hover), sie antippt (Handy)
// oder oben „Alles aufdecken“ drückt. So kann man erst selbst lesen/übersetzen.
import { useMemo, useState } from "react";
import { topicsByLesson, searchTopics, topicById } from "../lib/grammar";

export default function GrammarBrowse() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  // Global: alle Beispiele eines Themas gleichzeitig aufdecken.
  const [revealAll, setRevealAll] = useState(false);
  // Einzeln aufgedeckte Beispiele (per Klick/Tap), als Set von Indizes.
  const [revealed, setRevealed] = useState(() => new Set());

  const groups = useMemo(() => topicsByLesson(), []);
  const results = useMemo(() => searchTopics(query), [query]);
  const resultIds = useMemo(() => new Set(results.map((t) => t.id)), [results]);

  // Ein Thema öffnen und den Aufdeck-Zustand zurücksetzen.
  function openTopic(id) {
    setOpenId(id);
    setRevealAll(false);
    setRevealed(new Set());
  }

  // Ein einzelnes Beispiel per Klick/Tap dauerhaft auf-/zudecken.
  function toggleRevealed(i) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  // Detailansicht eines Themas
  if (openId != null) {
    const t = topicById[openId];
    return (
      <div className="space-y-4">
        <button
          onClick={() => setOpenId(null)}
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Zurück zur Liste
        </button>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold">
              <span className="text-zinc-400">{t.id}. </span>
              {t.titel}
            </h2>
            <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              {t.lektion}
            </span>
          </div>
          <p className="hanzi rounded-lg bg-zinc-100 px-3 py-2 text-lg dark:bg-zinc-900">
            {t.struktur}
          </p>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            {t.erklaerung}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Beispiele</h3>
          <button
            onClick={() => setRevealAll((v) => !v)}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-sm text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600 dark:text-zinc-300 dark:hover:text-indigo-400"
          >
            {revealAll ? "Pinyin & Übersetzung verbergen" : "Alles aufdecken"}
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          Karte überfahren oder antippen, um Pinyin und Übersetzung aufzudecken.
        </p>

        <div className="space-y-2">
          {t.beispiele.map((b, i) => {
            // Aufgedeckt, wenn global aufgedeckt oder diese Karte einzeln geklickt wurde.
            const shown = revealAll || revealed.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleRevealed(i)}
                className="group block w-full rounded-xl border border-zinc-200 bg-white p-4 text-left dark:border-zinc-700 dark:bg-zinc-800"
              >
                <p className="hanzi text-2xl leading-snug">{b.zeichen}</p>
                {/* Verdeckt (unscharf, nicht markierbar); Hover/Tap deckt auf. */}
                <div
                  className={`transition duration-150 ${
                    shown ? "" : "select-none blur-sm group-hover:blur-none"
                  }`}
                >
                  <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">{b.pinyin}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">{b.deutsch}</p>
                </div>
              </button>
            );
          })}
        </div>

        {t.merke && (
          <div className="rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="font-semibold">Merke: </span>
            <span className="hanzi">{t.merke}</span>
          </div>
        )}
      </div>
    );
  }

  // Listenansicht
  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Suchen (Titel, 汉字, Pinyin, Deutsch) …"
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 outline-none focus:border-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
      />

      {groups.map((g) => {
        const shown = g.topics.filter((t) => resultIds.has(t.id));
        if (shown.length === 0) return null;
        return (
          <section key={g.lektion}>
            <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {g.lektion}
            </h3>
            <div className="space-y-1.5">
              {shown.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTopic(t.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <span className="w-6 shrink-0 text-center text-sm font-semibold text-zinc-400">
                    {t.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.titel}</span>
                    <span className="hanzi block truncate text-xs text-zinc-400">
                      {t.struktur}
                    </span>
                  </span>
                  <span className="shrink-0 text-zinc-300">›</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {resultIds.size === 0 && (
        <p className="text-center text-sm text-zinc-500">Keine Themen gefunden.</p>
      )}
    </div>
  );
}
