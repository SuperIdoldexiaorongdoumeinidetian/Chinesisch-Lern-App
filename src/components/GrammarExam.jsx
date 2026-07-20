// Prüfungsmodus: generiert eine Probeklausur im Stil von Probeklausur_1_Lek4-6:
// gemischte Aufgabenblöcke mit Punktevergabe. Am Ende Auswertung mit Punktzahl,
// Prozent und Liste der Themen mit Fehlern. Ergebnisse fließen auch in den
// Grammatik-Fortschritt ein.
import { useMemo, useState } from "react";
import { LESSON_ORDER, GRAMMAR_TOPICS, buildExam, topicById } from "../lib/grammar";
import { bumpGrammar } from "../lib/store";
import GrammarExercise from "./GrammarExercise";

export default function GrammarExam({ state, setState }) {
  const [phase, setPhase] = useState("setup");
  const [lessons, setLessons] = useState(LESSON_ORDER);
  const [exam, setExam] = useState(null);
  const [flat, setFlat] = useState([]); // [{ ex, section }]
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState([]); // [{ topicId, correct, punkte }]

  const topicsInScope = useMemo(
    () => GRAMMAR_TOPICS.filter((t) => lessons.includes(t.lektion)),
    [lessons]
  );

  const toggleLesson = (l) =>
    setLessons((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  const start = () => {
    const built = buildExam(topicsInScope.map((t) => t.id));
    if (!built.exercises.length) return;
    setExam(built);
    setFlat(built.sections.flatMap((s) => s.exercises.map((ex) => ({ ex, section: s }))));
    setIdx(0);
    setResults([]);
    setPhase("run");
  };

  const record = (correct) => {
    const { ex } = flat[idx];
    setResults((r) => [...r, { topicId: ex.topicId, correct, punkte: ex.punkte }]);
    setState((s) => ({ ...s, grammar: bumpGrammar(s.grammar, ex.topicId, correct) }));
  };

  const next = () => {
    if (idx + 1 >= flat.length) setPhase("done");
    else setIdx(idx + 1);
  };

  // ---- Setup ----
  if (phase === "setup") {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200">
          Eine gemischte Probeklausur aus allen Aufgabenformaten mit Punktevergabe – am
          Ende gibt es Punktzahl, Prozent und deine Fehlerschwerpunkte.
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Schwerpunkt (Lektionen)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {LESSON_ORDER.map((l) => (
              <button
                key={l}
                onClick={() => toggleLesson(l)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  lessons.includes(l)
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={start}
          disabled={topicsInScope.length === 0}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
        >
          Probeklausur starten
        </button>
      </div>
    );
  }

  // ---- Auswertung ----
  if (phase === "done") {
    const gained = results.filter((r) => r.correct).reduce((s, r) => s + r.punkte, 0);
    const pct = exam.total ? Math.round((gained / exam.total) * 100) : 0;
    // Themen mit Fehlern zusammenfassen
    const errByTopic = {};
    for (const r of results) if (!r.correct) errByTopic[r.topicId] = (errByTopic[r.topicId] ?? 0) + 1;
    const errList = Object.entries(errByTopic).sort((a, b) => b[1] - a[1]);

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-5xl">{pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📚"}</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {gained} / {exam.total}
          </p>
          <p className="text-sm text-zinc-500">Punkte · {pct} %</p>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Themen mit Fehlern
          </h3>
          {errList.length === 0 ? (
            <p className="text-sm text-emerald-600">Keine Fehler – sehr stark! 🎉</p>
          ) : (
            <div className="space-y-1.5">
              {errList.map(([id, count]) => (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm dark:bg-rose-950/40"
                >
                  <span className="w-6 shrink-0 text-center font-semibold text-rose-500">
                    {id}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{topicById[id].titel}</span>
                  <span className="shrink-0 text-xs text-rose-500">
                    {count} Fehler
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          onClick={() => setPhase("setup")}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          Neue Probeklausur
        </button>
      </div>
    );
  }

  // ---- Durchlauf ----
  const cur = flat[idx];
  const gainedSoFar = results.filter((r) => r.correct).reduce((s, r) => s + r.punkte, 0);
  // Abschnittsüberschrift nur beim ersten Item des Abschnitts zeigen
  const isSectionStart = idx === 0 || flat[idx - 1].section !== cur.section;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Aufgabe {idx + 1} / {flat.length}
        </span>
        <span>Punkte: {gainedSoFar}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${((idx + 1) / flat.length) * 100}%` }}
        />
      </div>
      {isSectionStart && (
        <h3 className="border-l-4 border-indigo-500 pl-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
          {cur.section.roman}. {cur.section.titel} · {cur.section.punkte} P.
        </h3>
      )}
      <GrammarExercise
        key={cur.ex.id}
        exercise={cur.ex}
        onResult={record}
        onNext={next}
        nextLabel={idx + 1 >= flat.length ? "Auswertung" : "Weiter"}
      />
    </div>
  );
}
