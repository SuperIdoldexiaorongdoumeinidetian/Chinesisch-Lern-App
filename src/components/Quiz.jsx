// Quiz-Modi (ohne Einfluss auf den SRS-Lernstand — reines Üben):
// 1. Hanzi → Bedeutung (Multiple Choice)
// 2. Bedeutung → Hanzi (Multiple Choice)
// 3. Hanzi → Pinyin (Texteingabe, Töne als Zahlen: "dian4hua4")
import { useMemo, useState } from "react";
import DeckPicker from "./DeckPicker";
import { buildPool, mcOptions, sample } from "../lib/deck";
import { checkPinyin } from "../lib/pinyin";
import ExamBadge from "./ExamBadge";

const MODES = {
  hm: "Hanzi → Bedeutung",
  mh: "Bedeutung → Hanzi",
  hp: "Hanzi → Pinyin",
};
const QUIZ_LENGTH = 15;

export default function Quiz({ state, setState }) {
  const { settings } = state;
  const [phase, setPhase] = useState("setup");
  const [mode, setMode] = useState("hm");
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(null); // gewählte Option / Eingabe-Ergebnis
  const [input, setInput] = useState("");

  const pool = useMemo(
    () =>
      buildPool(
        settings.decks,
        settings.includeProperNames,
        settings.onlyHighlighted
      ),
    [settings.decks, settings.includeProperNames, settings.onlyHighlighted]
  );
  const updateSettings = (patch) =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const start = () => {
    // Für Pinyin-Modus nur Karten mit Pinyin (Radikale haben keins).
    const candidates = mode === "hp" ? pool.filter((c) => c.pinyin) : pool;
    const cards = sample(candidates, Math.min(QUIZ_LENGTH, candidates.length));
    setQuestions(
      cards.map((card) =>
        mode === "hp"
          ? { card }
          : { card, options: mcOptions(card, candidates, mode === "hm" ? "meaning" : "hanzi") }
      )
    );
    setIdx(0);
    setScore(0);
    setAnswered(null);
    setInput("");
    setPhase("quiz");
  };

  const next = () => {
    if (idx + 1 >= questions.length) setPhase("done");
    else {
      setIdx(idx + 1);
      setAnswered(null);
      setInput("");
    }
  };

  if (phase === "setup") {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(MODES).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                mode === key
                  ? "bg-sky-600 text-white"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <DeckPicker
          decks={settings.decks}
          onDecks={(d) => updateSettings({ decks: d })}
          directions={settings.directions}
          onDirections={() => {}}
          showDirections={false}
          includeProperNames={settings.includeProperNames}
          onIncludeProperNames={(v) => updateSettings({ includeProperNames: v })}
          onlyHighlighted={settings.onlyHighlighted}
          onOnlyHighlighted={(v) => updateSettings({ onlyHighlighted: v })}
        />
        <button
          onClick={start}
          disabled={pool.length < 4}
          className="w-full rounded-xl bg-sky-600 py-3 font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-40"
        >
          Quiz starten ({Math.min(QUIZ_LENGTH, pool.length)} Fragen)
        </button>
        {pool.length < 4 && (
          <p className="text-center text-sm text-zinc-500">
            Mindestens 4 Karten nötig — bitte mehr Decks auswählen.
          </p>
        )}
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
          className="rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-700"
        >
          Neues Quiz
        </button>
      </div>
    );
  }

  // ---- Frageansicht ----
  const q = questions[idx];
  const { card } = q;

  const submitPinyin = () => {
    if (!input.trim()) return;
    const result = checkPinyin(input, card.pinyin);
    if (result === "correct") setScore((s) => s + 1);
    setAnswered(result);
  };

  const choose = (opt) => {
    if (answered) return;
    setAnswered(opt.id);
    if (opt.id === card.id) setScore((s) => s + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Frage {idx + 1} / {questions.length}
        </span>
        <span>
          {card.lesson} · Punkte: {score}
        </span>
      </div>

      <div className="relative flex min-h-40 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        {/* Erst nach dem Antworten zeigen, damit es bei Multiple Choice kein
            Hinweis ist. Gelb = prüfungsrelevant. */}
        {answered && <ExamBadge card={card} className="absolute left-3 top-3" />}
        {mode === "mh" ? (
          <p className="text-2xl">{card.meaning}</p>
        ) : (
          <p className="hanzi text-6xl leading-tight">{card.hanzi}</p>
        )}
        {answered && mode === "hp" && (
          <p className="mt-3 text-xl text-emerald-600 dark:text-emerald-400">
            {card.pinyin}
            <span className="ml-2 text-sm text-zinc-400">{card.meaning}</span>
          </p>
        )}
      </div>

      {mode === "hp" ? (
        <div className="space-y-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (answered ? next() : submitPinyin())}
            placeholder="Pinyin, z. B. dian4hua4"
            autoFocus
            disabled={!!answered}
            className={`w-full rounded-xl border px-4 py-3 text-lg outline-none dark:bg-zinc-800 ${
              answered === "correct"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                : answered
                  ? "border-rose-500 bg-rose-50 dark:bg-rose-950"
                  : "border-zinc-300 focus:border-sky-500 dark:border-zinc-600"
            }`}
          />
          {answered === "tones" && (
            <p className="text-sm text-amber-600">
              Silben richtig, aber die Töne stimmen nicht.
            </p>
          )}
          <button
            onClick={answered ? next : submitPinyin}
            className="w-full rounded-xl bg-sky-600 py-3 font-semibold text-white hover:bg-sky-700"
          >
            {answered ? "Weiter" : "Prüfen"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {q.options.map((opt) => {
              const isCorrect = opt.id === card.id;
              let cls =
                "border-zinc-200 bg-white hover:border-sky-400 dark:border-zinc-700 dark:bg-zinc-800";
              if (answered) {
                if (isCorrect)
                  cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950";
                else if (answered === opt.id)
                  cls = "border-rose-500 bg-rose-50 dark:bg-rose-950";
                else cls = "border-zinc-200 opacity-50 dark:border-zinc-700";
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => choose(opt)}
                  className={`rounded-xl border p-4 text-center transition-colors ${cls}`}
                >
                  {mode === "hm" ? (
                    <span className="text-base">{opt.meaning}</span>
                  ) : (
                    <span className="hanzi text-3xl">{opt.hanzi}</span>
                  )}
                </button>
              );
            })}
          </div>
          {answered && (
            <>
              <p className="text-center text-sm text-zinc-500">
                {card.hanzi} · {card.pinyin} · {card.meaning}
              </p>
              <button
                onClick={next}
                autoFocus
                className="w-full rounded-xl bg-sky-600 py-3 font-semibold text-white hover:bg-sky-700"
              >
                Weiter
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
