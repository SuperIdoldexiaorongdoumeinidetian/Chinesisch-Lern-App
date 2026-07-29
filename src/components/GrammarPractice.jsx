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
import { AI_AVAILABLE, buildAITopicPractice, buildAIMixedPractice } from "../lib/grammarAI";
import GrammarExercise from "./GrammarExercise";

const MIXED_LENGTH = 12;

export default function GrammarPractice({ state, setState }) {
  const [phase, setPhase] = useState("setup");
  const [lessons, setLessons] = useState(LESSON_ORDER); // gewählte Lektionen
  const [topicId, setTopicId] = useState(null); // optional: einzelnes Thema
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [useAI, setUseAI] = useState(false); // KI-Übungen mit großem Wortschatz
  const [loading, setLoading] = useState(false); // während die KI Aufgaben baut

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

  const start = async () => {
    const desired = topicId ? TOPIC_SET_LENGTH : MIXED_LENGTH;
    const ids = topicsInScope.map((t) => t.id);

    // 1) KI-Aufgaben versuchen (falls aktiviert). Bei fehlendem Login/Key/Netz
    //    liefert das Modul ein leeres Array – wir füllen dann unten lokal auf.
    let picked = [];
    if (useAI) {
      setLoading(true);
      try {
        picked = topicId
          ? await buildAITopicPractice(topicId, desired)
          : await buildAIMixedPractice(ids, desired);
      } catch {
        picked = [];
      }
      setLoading(false);
    }

    // 2) Rest (oder alles, wenn KI aus/fehlgeschlagen) mit dem lokalen
    //    Generator auffüllen. So ist der lokale Weg der verlässliche Fallback.
    if (picked.length < desired) {
      const local = topicId
        ? buildTopicPractice(topicId)
        : buildMixedPractice(ids, state.grammar, desired);
      picked = [...picked, ...local].slice(0, desired);
    }

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

        {/* KI-Übungen: nutzen den kompletten Kaishi-Wortschatz für mehr
            Abwechslung. Nur verfügbar, wenn der Cloud-Login (Missbrauchsschutz
            des KI-Proxys) eingerichtet ist. Ohne Login/bei Fehlern fällt die
            App automatisch auf die lokal erzeugten Aufgaben zurück. */}
        {AI_AVAILABLE && (
          <div>
            <button
              onClick={() => setUseAI((v) => !v)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors ${
                useAI
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-zinc-200 dark:border-zinc-700"
              }`}
            >
              <span className="font-medium">✨ KI-Übungen (größerer Wortschatz)</span>
              <span
                className={`ml-3 inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  useAI ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    useAI ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
            {useAI && (
              <p className="mt-1.5 text-xs text-zinc-500">
                Erfordert Anmeldung. Kann ein paar Sekunden dauern; bei Problemen
                werden automatisch lokale Aufgaben verwendet.
              </p>
            )}
          </div>
        )}

        <button
          onClick={start}
          disabled={topicsInScope.length === 0 || loading}
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
        >
          {loading
            ? "Erzeuge KI-Aufgaben …"
            : topicId
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
