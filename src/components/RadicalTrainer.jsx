// Radikal-Trainer: Radikal → deutsche Bedeutung als Multiple Choice,
// filterbar nach Strichzahl.
import { useMemo, useState } from "react";
import { allRadicals, sample } from "../lib/deck";

export default function RadicalTrainer() {
  const [strokeFilter, setStrokeFilter] = useState("alle");
  const [phase, setPhase] = useState("setup");
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(null);

  const strokeCounts = useMemo(
    () => [...new Set(allRadicals.map((r) => r.strokes))].sort((a, b) => a - b),
    []
  );

  const filtered = useMemo(
    () =>
      strokeFilter === "alle"
        ? allRadicals
        : allRadicals.filter((r) => r.strokes === Number(strokeFilter)),
    [strokeFilter]
  );

  const start = () => {
    const cards = sample(filtered, Math.min(15, filtered.length));
    setQuestions(
      cards.map((r) => {
        // Distraktoren bevorzugt mit ähnlicher Strichzahl (±1)
        const near = allRadicals.filter(
          (x) => x.number !== r.number && Math.abs(x.strokes - r.strokes) <= 1
        );
        const distractors = sample(near, 3);
        if (distractors.length < 3) {
          const rest = allRadicals.filter(
            (x) => x.number !== r.number && !distractors.includes(x)
          );
          distractors.push(...sample(rest, 3 - distractors.length));
        }
        return { radical: r, options: sample([r, ...distractors], 4) };
      })
    );
    setIdx(0);
    setScore(0);
    setAnswered(null);
    setPhase("quiz");
  };

  const next = () => {
    if (idx + 1 >= questions.length) setPhase("done");
    else {
      setIdx(idx + 1);
      setAnswered(null);
    }
  };

  if (phase === "setup") {
    return (
      <div className="space-y-5">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          Strichzahl:
          <select
            value={strokeFilter}
            onChange={(e) => setStrokeFilter(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="alle">alle ({allRadicals.length})</option>
            {strokeCounts.map((s) => (
              <option key={s} value={s}>
                {s} Strich{s > 1 ? "e" : ""} (
                {allRadicals.filter((r) => r.strokes === s).length})
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={start}
          disabled={filtered.length === 0}
          className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
        >
          Training starten ({Math.min(15, filtered.length)} Fragen)
        </button>

        {/* Nachschlage-Liste der gefilterten Radikale */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={r.number}
              className="flex items-center gap-2 rounded-lg bg-zinc-100 px-2 py-1.5 text-sm dark:bg-zinc-800"
            >
              <span className="hanzi text-xl">{r.radical}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{r.meaning}</span>
                <span className="text-xs text-zinc-400">
                  Nr. {r.number} · {r.strokes} Str.
                  {r.variants.length > 0 && ` · ${r.variants.join(" ")}`}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-5xl">{score / questions.length >= 0.8 ? "🏆" : "💪"}</p>
        <h2 className="text-xl font-bold">
          {score} von {questions.length} richtig
        </h2>
        <button
          onClick={() => setPhase("setup")}
          className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
        >
          Zurück
        </button>
      </div>
    );
  }

  const q = questions[idx];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Frage {idx + 1} / {questions.length}
        </span>
        <span>Punkte: {score}</span>
      </div>

      <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <p className="hanzi text-7xl">{q.radical.radical}</p>
        <p className="mt-2 text-sm text-zinc-400">
          Radikal Nr. {q.radical.number} · {q.radical.strokes} Strich
          {q.radical.strokes > 1 ? "e" : ""}
          {answered && q.radical.variants.length > 0 && (
            <> · Varianten: {q.radical.variants.join(" ")}</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {q.options.map((opt) => {
          const isCorrect = opt.number === q.radical.number;
          let cls =
            "border-zinc-200 bg-white hover:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800";
          if (answered) {
            if (isCorrect)
              cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950";
            else if (answered === opt.number)
              cls = "border-rose-500 bg-rose-50 dark:bg-rose-950";
            else cls = "border-zinc-200 opacity-50 dark:border-zinc-700";
          }
          return (
            <button
              key={opt.number}
              onClick={() => {
                if (answered) return;
                setAnswered(opt.number);
                if (isCorrect) setScore((s) => s + 1);
              }}
              className={`rounded-xl border p-4 transition-colors ${cls}`}
            >
              {opt.meaning}
            </button>
          );
        })}
      </div>

      {answered && (
        <button
          onClick={next}
          autoFocus
          className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700"
        >
          Weiter
        </button>
      )}
    </div>
  );
}
