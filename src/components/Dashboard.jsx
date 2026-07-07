// Dashboard: Gesamtfortschritt, heute fällige Karten, Streak,
// Fortschritt pro Lektion und Reviews der letzten 30 Tage.
import { useMemo } from "react";
import {
  LESSONS,
  RADICAL_DECK,
  vocabCards,
  radicalCards,
  srsKey,
  isExamRelevant,
} from "../lib/deck";
import { todayStr } from "../lib/srs";
import { calcStreak } from "../lib/store";

const ALL_DIRS = ["hm", "mh", "hp"];

export default function Dashboard({ state, onReset }) {
  const today = todayStr();
  const allCards = useMemo(() => [...vocabCards, ...radicalCards], []);

  // Eine Karte gilt als "gelernt", wenn sie in mindestens einer Richtung
  // schon einmal bewertet wurde.
  const learnedIds = useMemo(() => {
    const set = new Set();
    for (const card of allCards) {
      if (ALL_DIRS.some((d) => state.srs[srsKey(card, d)])) set.add(card.id);
    }
    return set;
  }, [allCards, state.srs]);

  // Heute fällige Karten (über alle Richtungen, unabhängig von der Deck-Auswahl).
  // "Fällig" = Fälligkeitszeitpunkt liegt vor dem Ende des heutigen Tages.
  const dueCount = useMemo(() => {
    const endOfToday = Date.parse(`${today}T00:00:00`) + 24 * 60 * 60 * 1000;
    return Object.values(state.srs).filter(
      (s) => s.dueDate != null && s.dueDate < endOfToday
    ).length;
  }, [state.srs, today]);

  const streak = calcStreak(state.log, today);

  // Fortschritt pro Lektion (Eigennamen ausgenommen, die lernt man ja nicht).
  const lessonProgress = useMemo(() => {
    const rows = [];
    for (const lesson of [...LESSONS, RADICAL_DECK]) {
      const cards =
        lesson === RADICAL_DECK
          ? radicalCards
          : vocabCards.filter((c) => c.lesson === lesson && !c.isProperName);
      const learned = cards.filter((c) => learnedIds.has(c.id)).length;
      rows.push({ lesson, learned, total: cards.length });
    }
    return rows;
  }, [learnedIds]);

  // Fortschritt bei den prüfungsrelevanten (im Original gelb markierten)
  // Vokabeln — quer über alle Lektionen.
  const exam = useMemo(() => {
    const cards = vocabCards.filter(isExamRelevant);
    const learned = cards.filter((c) => learnedIds.has(c.id)).length;
    return { learned, total: cards.length };
  }, [learnedIds]);

  // Reviews der letzten 30 Tage für das Balkendiagramm.
  const days = useMemo(() => {
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("sv-SE");
      out.push({ key, reviews: state.log[key]?.reviews ?? 0 });
    }
    return out;
  }, [state.log]);
  const maxReviews = Math.max(1, ...days.map((d) => d.reviews));

  return (
    <div className="space-y-6">
      {/* Kennzahlen */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Gelernt" value={learnedIds.size} sub="Karten" />
        <Stat label="Fällig heute" value={dueCount} sub="Wiederholungen" />
        <Stat label="Streak" value={streak} sub={streak === 1 ? "Tag" : "Tage"} />
      </div>

      {/* Prüfungsrelevante (gelb markierte) Vokabeln */}
      <section>
        <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          <span>★ Prüfungsrelevante Vokabeln</span>
          <span className="text-amber-600 dark:text-amber-400">
            {exam.learned}/{exam.total}
          </span>
        </h3>
        <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-amber-400 transition-all"
            style={{
              width: `${exam.total ? (exam.learned / exam.total) * 100 : 0}%`,
            }}
          />
        </div>
      </section>

      {/* Diagramm: Reviews pro Tag */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Reviews — letzte 30 Tage
        </h3>
        <div className="flex h-24 items-end gap-px rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800">
          {days.map((d) => (
            <div
              key={d.key}
              title={`${d.key}: ${d.reviews} Reviews`}
              className="flex-1 rounded-t bg-emerald-500/80"
              style={{
                height: `${(d.reviews / maxReviews) * 100}%`,
                minHeight: d.reviews > 0 ? 3 : 0,
              }}
            />
          ))}
        </div>
      </section>

      {/* Fortschritt pro Lektion */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Fortschritt pro Lektion
        </h3>
        <div className="space-y-1.5">
          {lessonProgress.map(({ lesson, learned, total }) => (
            <div key={lesson} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate text-zinc-600 dark:text-zinc-300">
                {lesson}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${total ? (learned / total) * 100 : 0}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs text-zinc-400">
                {learned}/{total}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Fortschritt zurücksetzen */}
      <section className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <button
          onClick={() => {
            if (
              window.confirm(
                "Gesamten Lernfortschritt (Karten-Zustände, Streak und Verlauf) wirklich zurücksetzen? Deine Einstellungen bleiben erhalten. Das lässt sich nicht rückgängig machen."
              )
            ) {
              onReset?.();
            }
          }}
          className="w-full rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          Fortschritt zurücksetzen
        </button>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
        {value}
      </p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-zinc-400">{sub}</p>
    </div>
  );
}
