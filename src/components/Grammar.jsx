// Bereich „Grammatik“: vier Unterbereiche, umgeschaltet über eine Leiste.
//  - Nachschlagen: alle 48 Themen, gruppiert nach Lektion, mit Suche/Detail
//  - Üben:         Aufgaben pro Thema oder gemischt nach Lektion
//  - Prüfung:      generierte Probeklausur mit Punkteauswertung
//  - Fortschritt:  richtig/falsch pro Thema, Schwerpunkte (Fehlerquote > 30 %)
import { useState } from "react";
import GrammarBrowse from "./GrammarBrowse";
import GrammarPractice from "./GrammarPractice";
import GrammarExam from "./GrammarExam";
import GrammarProgress from "./GrammarProgress";

const MODES = [
  { id: "browse", label: "Nachschlagen" },
  { id: "practice", label: "Üben" },
  { id: "exam", label: "Prüfung" },
  { id: "progress", label: "Fortschritt" },
];

export default function Grammar({ state, setState }) {
  const [mode, setMode] = useState("browse");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              mode === m.id
                ? "bg-indigo-600 text-white"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "browse" && <GrammarBrowse />}
      {mode === "practice" && <GrammarPractice state={state} setState={setState} />}
      {mode === "exam" && <GrammarExam state={state} setState={setState} />}
      {mode === "progress" && <GrammarProgress state={state} />}
    </div>
  );
}
