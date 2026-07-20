// Eine einzelne Grammatik-Übung – für alle sieben Aufgabenformate.
// Wird sowohl im Übungs- als auch im Prüfungsmodus verwendet.
//
// Ablauf: Der Nutzer gibt eine Antwort ein (Format-abhängig), drückt „Prüfen“;
// danach werden Richtig/Falsch und die Musterlösung angezeigt. Die offenen
// Formate (Frage stellen/beantworten) lassen sich nicht eindeutig prüfen –
// dort zeigt man die Musterlösung und der Nutzer bewertet sich selbst.
//
// onResult(correct) wird genau einmal aufgerufen (fürs Fortschritt-Hochzählen).
// Der Elternteil sollte key={exercise.id} setzen, damit bei einer neuen Aufgabe
// der interne Zustand zurückgesetzt wird.
import { useState } from "react";
import { checkAnswer, isAutoCheck } from "../lib/grammar";

const FORMAT_LABEL = {
  lueckentext: "Lückentext",
  reihenfolge: "Reihenfolge",
  wort_einsetzen: "Wort einsetzen",
  uebersetzung: "Übersetzung",
  fehler: "Fehler korrigieren",
  umformung: "Umformung",
  frage_beantworten: "Frage beantworten",
  frage_stellen: "Frage stellen",
};

export default function GrammarExercise({ exercise: ex, onResult, onNext, nextLabel = "Weiter" }) {
  // answered: null | "correct" | "wrong"
  const [answered, setAnswered] = useState(null);
  const [blanks, setBlanks] = useState(() =>
    ex.format === "lueckentext" ? Array(ex.loesungen.length).fill("") : []
  );
  const [text, setText] = useState("");
  const [order, setOrder] = useState([]); // Reihenfolge: gewählte Token-Indizes
  const [insertAt, setInsertAt] = useState(null); // Wort einsetzen: gewählter Slot
  const [revealed, setRevealed] = useState(false); // offene Formate: Lösung gezeigt

  const settle = (correct) => {
    setAnswered(correct ? "correct" : "wrong");
    onResult?.(correct);
  };

  // --- Auto-geprüfte Formate ---
  const submitAuto = () => {
    let answer;
    if (ex.format === "lueckentext") answer = blanks;
    else if (ex.format === "reihenfolge") answer = order.map((i) => ex.tokens[i]).join("");
    else if (ex.format === "wort_einsetzen") {
      if (insertAt == null) return;
      answer = [...ex.basis.slice(0, insertAt), ex.wort, ...ex.basis.slice(insertAt)].join("");
    } else answer = text;
    settle(checkAnswer(ex, answer));
  };

  const canSubmit =
    ex.format === "lueckentext"
      ? blanks.every((b) => b.trim())
      : ex.format === "reihenfolge"
        ? order.length === ex.tokens.length
        : ex.format === "wort_einsetzen"
          ? insertAt != null
          : text.trim().length > 0;

  const feedbackCls =
    answered === "correct"
      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
      : answered === "wrong"
        ? "border-rose-500 bg-rose-50 dark:bg-rose-950"
        : "border-zinc-200 dark:border-zinc-700";

  return (
    <div className="space-y-4">
      {/* Aufgabenkopf */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
          {FORMAT_LABEL[ex.format]}
        </span>
        <span>
          Thema {ex.topicId} · {ex.punkte} P.
        </span>
      </div>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{ex.frage}</p>

      {/* Aufgabenkörper je Format */}
      <div className={`rounded-2xl border bg-white p-5 dark:bg-zinc-800 ${feedbackCls}`}>
        {ex.format === "lueckentext" && (
          <LueckentextBody ex={ex} blanks={blanks} setBlanks={setBlanks} disabled={!!answered} />
        )}
        {ex.format === "reihenfolge" && (
          <ReihenfolgeBody ex={ex} order={order} setOrder={setOrder} disabled={!!answered} />
        )}
        {ex.format === "wort_einsetzen" && (
          <WortEinsetzenBody ex={ex} insertAt={insertAt} setInsertAt={setInsertAt} disabled={!!answered} />
        )}
        {(ex.format === "uebersetzung" || ex.format === "fehler" || ex.format === "umformung") && (
          <TextBody ex={ex} text={text} setText={setText} disabled={!!answered} onEnter={submitAuto} />
        )}
        {(ex.format === "frage_beantworten" || ex.format === "frage_stellen") && (
          <OpenBody ex={ex} text={text} setText={setText} disabled={revealed} revealed={revealed} />
        )}
      </div>

      {/* Steuerung */}
      {!answered ? (
        isAutoCheck(ex) ? (
          <button
            onClick={submitAuto}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
          >
            Prüfen
          </button>
        ) : !revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            Lösung zeigen
          </button>
        ) : (
          <SelfAssess ex={ex} onPick={settle} />
        )
      ) : (
        <div className="space-y-3">
          <Solution ex={ex} answered={answered} />
          <button
            onClick={onNext}
            autoFocus
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700"
          >
            {nextLabel}
          </button>
        </div>
      )}

      {/* Bei offenen Formaten die Lösung schon beim Aufdecken zeigen */}
      {revealed && !answered && <Solution ex={ex} answered={null} />}
    </div>
  );
}

// --- Format-Körper -------------------------------------------------------

function LueckentextBody({ ex, blanks, setBlanks, disabled }) {
  const parts = ex.satz.split("___");
  const setBlank = (i, val) => {
    const next = [...blanks];
    next[i] = val;
    setBlanks(next);
  };
  return (
    <div className="space-y-3">
      <p className="hanzi flex flex-wrap items-center gap-1 text-2xl leading-relaxed">
        {parts.map((part, i) => (
          <span key={i} className="contents">
            <span>{part}</span>
            {i < parts.length - 1 &&
              (ex.optionen?.[i] ? (
                // Auswahl-Lücke: gewählte Option anzeigen
                <span className="hanzi inline-block min-w-16 rounded-lg border border-dashed border-indigo-400 bg-indigo-50 px-2 py-1 text-center text-xl dark:bg-indigo-950/40">
                  {blanks[i] || "＿"}
                </span>
              ) : (
                <input
                  value={blanks[i]}
                  disabled={disabled}
                  onChange={(e) => setBlank(i, e.target.value)}
                  className="hanzi w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-center text-xl outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
                />
              ))}
          </span>
        ))}
      </p>
      {/* Antwortmöglichkeiten (der Generator liefert 1 richtige + 3 Distraktoren) */}
      {ex.optionen?.map((opts, i) => (
        <div key={i} className="flex flex-wrap gap-1.5">
          {opts.map((opt) => (
            <button
              key={opt}
              disabled={disabled}
              onClick={() => setBlank(i, blanks[i] === opt ? "" : opt)}
              className={`hanzi rounded-lg px-3 py-1.5 text-lg transition-colors ${
                blanks[i] === opt
                  ? "bg-indigo-600 text-white"
                  : "border border-zinc-300 bg-white hover:border-indigo-400 dark:border-zinc-600 dark:bg-zinc-800"
              } disabled:opacity-60`}
            >
              {opt}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function ReihenfolgeBody({ ex, order, setOrder, disabled }) {
  const remaining = ex.tokens.map((_, i) => i).filter((i) => !order.includes(i));
  return (
    <div className="space-y-3">
      {/* Gewählte Reihenfolge */}
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl bg-zinc-100 p-2 dark:bg-zinc-900">
        {order.length === 0 && (
          <span className="text-sm text-zinc-400">Tippe die Wörter der Reihe nach an …</span>
        )}
        {order.map((tok, pos) => (
          <button
            key={pos}
            disabled={disabled}
            onClick={() => setOrder(order.filter((_, p) => p !== pos))}
            className="hanzi rounded-lg bg-indigo-600 px-3 py-1.5 text-lg text-white"
          >
            {ex.tokens[tok]}
          </button>
        ))}
      </div>
      {/* Verfügbare Bausteine */}
      <div className="flex flex-wrap gap-1.5">
        {remaining.map((i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => setOrder([...order, i])}
            className="hanzi rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-lg hover:border-indigo-400 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
          >
            {ex.tokens[i]}
          </button>
        ))}
      </div>
    </div>
  );
}

function WortEinsetzenBody({ ex, insertAt, setInsertAt, disabled }) {
  // Slots zwischen (und vor/nach) allen Basis-Tokens.
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Einzusetzen:{" "}
        <span className="hanzi rounded bg-amber-100 px-2 py-0.5 text-lg text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
          {ex.wort}
        </span>
      </p>
      <div className="hanzi flex flex-wrap items-center gap-0.5 text-2xl">
        {ex.basis.map((tok, i) => (
          <span key={i} className="contents">
            <Slot active={insertAt === i} disabled={disabled} onClick={() => setInsertAt(i)} word={ex.wort} />
            <span>{tok}</span>
          </span>
        ))}
        <Slot
          active={insertAt === ex.basis.length}
          disabled={disabled}
          onClick={() => setInsertAt(ex.basis.length)}
          word={ex.wort}
        />
      </div>
    </div>
  );
}

function Slot({ active, disabled, onClick, word }) {
  if (active)
    return (
      <button
        disabled={disabled}
        onClick={onClick}
        className="hanzi rounded bg-amber-400 px-1.5 text-2xl text-amber-950"
      >
        {word}
      </button>
    );
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="mx-0.5 h-6 w-3 rounded-full border border-dashed border-zinc-300 align-middle text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-indigo-950"
      title="Hier einsetzen"
    />
  );
}

function TextBody({ ex, text, setText, disabled, onEnter }) {
  return (
    <div className="space-y-2">
      {ex.format === "fehler" ? (
        <p className="hanzi text-2xl leading-relaxed text-rose-600 line-through decoration-rose-400 dark:text-rose-400">
          {ex.falsch}
        </p>
      ) : ex.format === "umformung" ? (
        // Umformung: der Ausgangssatz, der umgeformt werden soll
        <p className="hanzi text-2xl leading-relaxed">{ex.quelle}</p>
      ) : (
        <p className="text-lg text-zinc-700 dark:text-zinc-200">{ex.deutsch}</p>
      )}
      <input
        value={text}
        disabled={disabled}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // preventDefault: sonst „klickt“ derselbe Enter-Tastendruck auch noch
          // den frisch fokussierten Weiter-Button und überspringt die Lösung
          if (e.key === "Enter" && canRun(text)) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder="Antwort in Schriftzeichen …"
        className="hanzi w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-2xl outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
      />
    </div>
  );
}

function OpenBody({ ex, text, setText, disabled, revealed }) {
  const prompt = ex.format === "frage_beantworten" ? ex.antwortFrage : ex.gegebeneAntwort;
  const label =
    ex.format === "frage_beantworten" ? "Frage:" : "Antwort (dazu die Frage bilden):";
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="hanzi text-2xl leading-relaxed">{prompt}</p>
      {/* Deutsche Übersetzung erst mit der Lösung zeigen – vorher soll man
          den chinesischen Satz selbst verstehen. */}
      {revealed && <p className="text-sm text-zinc-500">{ex.deutsch}</p>}
      <input
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dein Versuch (optional) …"
        className="hanzi mt-1 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-2xl outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
      />
    </div>
  );
}

function SelfAssess({ ex, onPick }) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/50">
        <p className="text-xs font-medium text-indigo-500">Musterlösung</p>
        <p className="hanzi text-2xl">{ex.loesung}</p>
        {ex.pinyin && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{ex.pinyin}</p>
        )}
      </div>
      <p className="text-center text-sm text-zinc-500">War deine Antwort richtig?</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPick(false)}
          className="rounded-xl border border-rose-300 py-3 font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          Falsch
        </button>
        <button
          onClick={() => onPick(true)}
          className="rounded-xl border border-emerald-300 py-3 font-semibold text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          Richtig
        </button>
      </div>
    </div>
  );
}

function Solution({ ex, answered }) {
  return (
    <div className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
      {answered && (
        <p className={answered === "correct" ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
          {answered === "correct" ? "✓ Richtig!" : "✗ Nicht ganz."}
        </p>
      )}
      <p className="mt-1">
        <span className="text-zinc-400">Lösung: </span>
        <span className="hanzi text-lg">{ex.loesung}</span>
      </p>
      {ex.pinyin && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{ex.pinyin}</p>
      )}
      {/* Deutsch nur bei den Formaten, die es nicht schon anderswo zeigen:
          Übersetzung nutzt Deutsch als Aufgabe, die offenen Frage-Formate
          zeigen es beim Aufdecken im OpenBody. */}
      {ex.deutsch &&
        !["uebersetzung", "frage_beantworten", "frage_stellen"].includes(ex.format) && (
          <p className="text-zinc-500">{ex.deutsch}</p>
        )}
      {ex.hinweis && <p className="mt-1 text-zinc-500">Merke: {ex.hinweis}</p>}
      <p className="mt-1 text-xs text-indigo-500">{ex.erklaerung}</p>
    </div>
  );
}

const canRun = (t) => t.trim().length > 0;
