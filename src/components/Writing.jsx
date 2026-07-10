// Schreibtraining mit hanzi-writer: Strichreihenfolge animiert ansehen
// oder im Quiz-Modus Zeichen mit Maus/Finger nachzeichnen.
// Hinweis: hanzi-writer lädt die Strichdaten pro Zeichen von einem CDN —
// dafür ist eine Internetverbindung nötig.
import { useEffect, useMemo, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { buildPool } from "../lib/deck";
import { LESSONS } from "../lib/deck";

// Nur echte CJK-Zeichen herausfiltern (keine lateinischen Buchstaben wie in "T恤衫")
const cjkChars = (s) => [...s].filter((ch) => /[一-鿿]/.test(ch));

export default function Writing({ state }) {
  const [lesson, setLesson] = useState(state.settings.decks[0] ?? "1-1");
  const [mode, setMode] = useState("animate"); // animate | quiz
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [status, setStatus] = useState(""); // Statusmeldung unter dem Feld
  const containerRef = useRef(null);
  const writerRef = useRef(null);

  // Wörter der gewählten Lektion (ohne Eigennamen, nur mit CJK-Zeichen)
  const words = useMemo(() => {
    const pool = buildPool([lesson], false, false, state.customVocab).filter(
      (c) => cjkChars(c.hanzi).length > 0
    );
    return pool;
  }, [lesson, state.customVocab]);

  const word = words[wordIdx];
  const chars = word ? cjkChars(word.hanzi) : [];
  const currentChar = chars[charIdx];

  // hanzi-writer-Instanz bei jedem Zeichenwechsel neu aufbauen
  useEffect(() => {
    if (!currentChar || !containerRef.current) return;
    containerRef.current.innerHTML = "";
    setStatus("");

    const writer = HanziWriter.create(containerRef.current, currentChar, {
      width: 260,
      height: 260,
      padding: 12,
      showCharacter: mode === "animate",
      showOutline: true,
      strokeColor: "#10b981",
      outlineColor: "#d4d4d8",
      drawingColor: "#0ea5e9",
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 200,
      onLoadCharDataError: () =>
        setStatus("Strichdaten konnten nicht geladen werden (Internet nötig)."),
    });
    writerRef.current = writer;

    if (mode === "animate") {
      writer.loopCharacterAnimation();
    } else {
      writer.quiz({
        showHintAfterMisses: 2,
        onComplete: ({ totalMistakes }) => {
          setStatus(
            totalMistakes === 0
              ? "Perfekt! ✨"
              : `Geschafft — ${totalMistakes} Fehlversuch${totalMistakes > 1 ? "e" : ""}.`
          );
        },
      });
    }
    return () => {
      // hanzi-writer hat kein destroy(); Container leeren reicht.
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [currentChar, mode, wordIdx]);

  const gotoWord = (i) => {
    setWordIdx(Math.max(0, Math.min(words.length - 1, i)));
    setCharIdx(0);
  };

  if (!word) {
    return (
      <p className="text-center text-zinc-500">
        Keine Wörter in dieser Lektion.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lesson}
          onChange={(e) => {
            setLesson(e.target.value);
            setWordIdx(0);
            setCharIdx(0);
          }}
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        >
          {LESSONS.map((l) => (
            <option key={l} value={l}>
              Lektion {l}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-zinc-300 text-sm dark:border-zinc-600">
          {[
            ["animate", "Ansehen"],
            ["quiz", "Nachzeichnen"],
          ].map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 transition-colors ${
                mode === m
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Wortinfo */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <p className="hanzi text-3xl">
          {chars.map((ch, i) => (
            <button
              key={i}
              onClick={() => setCharIdx(i)}
              className={`px-1 ${
                i === charIdx
                  ? "rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                  : ""
              }`}
            >
              {ch}
            </button>
          ))}
        </p>
        <p className="text-emerald-600 dark:text-emerald-400">{word.pinyin}</p>
        <p className="text-sm text-zinc-500">{word.meaning}</p>

        {/* Zeichenfläche */}
        <div className="mt-3 flex justify-center">
          <div
            ref={containerRef}
            className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900"
            style={{ width: 260, height: 260, touchAction: "none" }}
          />
        </div>
        {status && <p className="mt-2 text-sm text-zinc-500">{status}</p>}
        {chars.length > 1 && (
          <p className="mt-1 text-xs text-zinc-400">
            Zeichen {charIdx + 1} von {chars.length} — oben antippen zum Wechseln
          </p>
        )}
      </div>

      {/* Navigation durch die Wörter der Lektion */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => gotoWord(wordIdx - 1)}
          disabled={wordIdx === 0}
          className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-300 disabled:opacity-40 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          ← Vorheriges
        </button>
        <span className="text-sm text-zinc-500">
          Wort {wordIdx + 1} / {words.length}
        </span>
        <button
          onClick={() => gotoWord(wordIdx + 1)}
          disabled={wordIdx >= words.length - 1}
          className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-300 disabled:opacity-40 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          Nächstes →
        </button>
      </div>
    </div>
  );
}
