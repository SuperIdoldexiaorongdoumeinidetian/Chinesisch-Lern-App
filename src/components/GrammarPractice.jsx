// Üben: Aufgaben pro Thema oder gemischt nach Lektion.
// Die Aufgaben werden bei jedem Start frisch vom Generator gebaut (grammarGen);
// beim gemischten Üben werden Themen mit Fehlerquote > 30 % bevorzugt gezogen.
// Jedes Ergebnis wird im Grammatik-Fortschritt (state.grammar) festgehalten.
import { useMemo, useState } from "react";
import {
  LESSON_ORDER,
  GRAMMAR_TOPICS,
  TOPIC_SET_LENGTH,
  buildTopicPractice,
  buildMixedPractice,
  weakTopicIds,
} from "../lib/grammar";
import { bumpGrammar } from "../lib/store";
import GrammarExercise from "./GrammarExercise";

const MIXED_LENGTH = 12;

export default function GrammarPractice({ state, setState }) {
  const [phase, setPhase] = useState("setup");
  const [lessons, setLessons] = useState(LESSON_ORDER); // gewählte Lektionen
  const [topicId, setTopicId] = useState(null); // optional: einzelnes Thema
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);

  const weak = useMemo(() => new Set(weakTopicIds(state.grammar)), [state.grammar]);
  const topicsInScope = useMemo(
    () => GRAMMAR_TOPICS.filter((t) => lessons.includes(t.lektion)),
    [lessons]
  );

  const toggleLesson = (l) => {
    setTopicId(null);
    setLessons((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));
  };

  const record = (correct) => {
    if (correct) setScore((s) => s + 1);
    setState((s) => ({ ...s, grammar: bumpGrammar(s.grammar, items[idx].topicId, correct) }));
  };

  const start = () => {
    const picked = topicId
      ? buildTopicPractice(topicId)
      : buildMixedPractice(
          topicsInScope.map((t) => t.id),
          state.grammar,
          MIXED_LENGTH
        );
    if (!picked.length) return;
    setItems(picked);
    setIdx(0);
    setScore(0);
    setPhase("run");
  };

  const next = () => {
    if (idx + 1 >= items.length) setPhase("done");
    else setIdx(idx + 1);
  };

  // ---- Setup ----
  if (phase === "setup") {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Lektionen
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

        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Einzelnes Thema (optional) — sonst gemischt
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {topicsInScope.map((t) => (
              <button
                key={t.id}
                onClick={() => setTopicId(topicId === t.id ? null : t.id)}
                title={t.titel}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  topicId === t.id
                    ? "bg-indigo-600 text-white"
                    : weak.has(t.id)
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                      : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                }`}
              >
                {t.id}
              </button>
            ))}
          </div>
          {weak.size > 0 && !topicId && (
            <p className="mt-2 text-xs text-rose-500">
              Rot markierte Themen (Fehlerquote &gt; 30 %) werden beim gemischten Üben bevorzugt.
            </p>
          )}
        </div>

        <button
          onClick={start}
          disabled={topicsInScope.length === 0}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
        >
          {topicId
            ? `Thema ${topicId} üben (${TOPIC_SET_LENGTH} Aufgaben)`
            : `Gemischt üben (${MIXED_LENGTH} Aufgaben)`}
        </button>
      </div>
    );
  }

  // ---- Auswertung ----
  if (phase === "done") {
    const pct = items.length ? Math.round((score / items.length) * 100) : 0;
    return (
      <div className="space-y-4 text-center">
        <p className="text-5xl">{pct >= 80 ? "🏆" : "💪"}</p>
        <h2 className="text-xl font-bold">
          {score} von {items.length} richtig ({pct} %)
        </h2>
        <button
          onClick={() => setPhase("setup")}
          className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          Neue Übung
        </button>
      </div>
    );
  }

  // ---- Durchlauf ----
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Aufgabe {idx + 1} / {items.length}
        </span>
        <span>Punkte: {score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${((idx + 1) / items.length) * 100}%` }}
        />
      </div>
      <GrammarExercise
        key={items[idx].id}
        exercise={items[idx]}
        onResult={record}
        onNext={next}
        nextLabel={idx + 1 >= items.length ? "Auswertung" : "Weiter"}
      />
    </div>
  );
}
