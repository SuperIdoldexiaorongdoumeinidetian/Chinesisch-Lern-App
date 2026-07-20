// Fortschritt: pro Thema, wie viele Aufgaben richtig/falsch gelöst wurden.
// Themen mit Fehlerquote > 30 % sind die Schwerpunkte (werden beim gemischten
// Üben bevorzugt gezogen).
import { useMemo } from "react";
import { topicsByLesson, errorRate, weakTopicIds, topicById } from "../lib/grammar";

export default function GrammarProgress({ state }) {
  const grammar = state.grammar ?? {};
  const groups = useMemo(() => topicsByLesson(), []);
  const weak = useMemo(() => weakTopicIds(grammar), [grammar]);

  // Kennzahlen gesamt
  const totals = useMemo(() => {
    let correct = 0,
      wrong = 0,
      geuebt = 0;
    for (const t of Object.values(grammar)) {
      correct += t.correct ?? 0;
      wrong += t.wrong ?? 0;
      if ((t.correct ?? 0) + (t.wrong ?? 0) > 0) geuebt += 1;
    }
    return { correct, wrong, geuebt };
  }, [grammar]);

  return (
    <div className="space-y-6">
      {/* Kennzahlen */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Themen geübt" value={totals.geuebt} sub="von 48" />
        <Stat label="Richtig" value={totals.correct} sub="Aufgaben" />
        <Stat label="Falsch" value={totals.wrong} sub="Aufgaben" />
      </div>

      {/* Schwerpunkte */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Schwerpunkte (Fehlerquote &gt; 30 %)
        </h3>
        {weak.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Noch keine Schwerpunkte — übe ein paar Aufgaben, dann tauchen hier deine
            Fehlerthemen auf.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {weak.map((id) => (
              <span
                key={id}
                title={topicById[id].titel}
                className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
              >
                {id}. {topicById[id].titel}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Fortschritt pro Thema, nach Lektion gruppiert */}
      {groups.map((g) => (
        <section key={g.lektion}>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {g.lektion}
          </h3>
          <div className="space-y-1.5">
            {g.topics.map((t) => {
              const stat = grammar[t.id];
              const done = (stat?.correct ?? 0) + (stat?.wrong ?? 0);
              const rate = errorRate(stat);
              const correctPct = done ? ((stat.correct ?? 0) / done) * 100 : 0;
              const isWeak = rate != null && rate > 0.3;
              return (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-6 shrink-0 text-center text-xs font-semibold ${
                      isWeak ? "text-rose-500" : "text-zinc-400"
                    }`}
                  >
                    {t.id}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300"
                    title={t.titel}
                  >
                    {t.titel}
                  </span>
                  <div className="h-2.5 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isWeak ? "bg-rose-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${correctPct}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs text-zinc-400">
                    {done ? `${stat.correct ?? 0}/${done}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-zinc-400">{sub}</p>
    </div>
  );
}
