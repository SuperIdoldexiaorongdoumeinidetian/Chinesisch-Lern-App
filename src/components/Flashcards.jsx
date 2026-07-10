// Flashcard-Lernen mit Spaced Repetition.
// Ablauf: Setup (Decks/Richtungen wählen) → Session (erst fällige
// Wiederholungen, dann neue Karten) → Zusammenfassung.
//
// Session-Warteschlange (positionsbasiert): Die Queue ist eine geordnete
// Liste, die vorderste Karte (Index 0) ist die aktuelle. "Gut"/"Einfach"
// nehmen die Karte heraus → sie verlässt die Session. "Nochmal"/"Schwer"
// reihen die Karte ein paar Positionen weiter hinten wieder ein (siehe die
// GAP-Konstanten unten), sodass man sie schnell wiedersieht, ohne erst die
// ganze Queue durchzugehen. Die langfristigen Intervalle (interval/dueDate
// für künftige Sessions) bleiben davon unberührt – die regelt review() in
// srs.js. Die Session endet, sobald keine Karte mehr übrig ist.
import { useEffect, useMemo, useState } from "react";
import DeckPicker from "./DeckPicker";
import {
  buildPool,
  buildSession,
  srsKey,
  radicalsInWord,
  DIRECTIONS,
} from "../lib/deck";
import { review, RATINGS, previewIntervals, todayStr } from "../lib/srs";
import { bumpLog } from "../lib/store";
import { useSpeech } from "../lib/speech";
import SpeakButton from "./SpeakButton";
import ExamBadge from "./ExamBadge";

// --- Session-interne Reihenfolge ("Lern-Queue") ---------------------------
// Wie viele Karten überspringt eine mit "Nochmal"/"Schwer" bewertete Karte,
// bevor sie erneut erscheint? Hier zentral und leicht anpassbar.
// Min/Max ergeben eine kleine Zufallsstreuung im jeweiligen Bereich.
const AGAIN_GAP_MIN = 2; // "Nochmal": kurzer Abstand – nach 2–3 Karten zurück
const AGAIN_GAP_MAX = 3;
const HARD_GAP_MIN = 5; //  "Schwer":  etwas später – nach 5–6 Karten zurück
const HARD_GAP_MAX = 6;

// Ganze Zufallszahl in [min, max] (beide Grenzen eingeschlossen).
const randInt = (min, max) =>
  min + Math.floor(Math.random() * (max - min + 1));

export default function Flashcards({ state, setState }) {
  const { settings } = state;
  const speech = useSpeech();
  const [phase, setPhase] = useState("setup"); // setup | learn | done
  // Warteschlange: geordnete Liste von Einträgen { card, dir }. Die vorderste
  // Karte (Index 0) ist die aktuelle; die Reihenfolge steuert rate().
  const [queue, setQueue] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ learned: 0, again: 0 });
  // Anzahl einzigartiger Karten zu Session-Beginn – fixer Nenner für den
  // Fortschrittszähler "Karte X von Y" (ändert sich durch Wiederholungen nicht).
  const [total, setTotal] = useState(0);

  const pool = useMemo(
    () =>
      buildPool(
        settings.decks,
        settings.includeProperNames,
        settings.onlyHighlighted,
        state.customVocab
      ),
    [settings.decks, settings.includeProperNames, settings.onlyHighlighted, state.customVocab]
  );

  // Wie viele neue Karten heute noch erlaubt sind (Tageslimit).
  const today = todayStr();
  const newToday = state.log[today]?.newCards ?? 0;
  const session = useMemo(
    () =>
      buildSession(
        pool,
        settings.directions,
        state.srs,
        settings.newPerDay - newToday
      ),
    [pool, settings.directions, state.srs, settings.newPerDay, newToday]
  );

  // Aktuelle Karte = vorderste Karte der Queue (Index 0). Die Reihenfolge wird
  // rein über die Position gesteuert, nicht mehr über Zeitstempel.
  const current = queue[0] ?? null;

  // Session ist vorbei, sobald keine Karte mehr in der Warteschlange ist.
  useEffect(() => {
    if (phase === "learn" && queue.length === 0) setPhase("done");
  }, [phase, queue.length]);

  const updateSettings = (patch) =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const start = () => {
    // Reihenfolge: erst fällige Wiederholungen, dann neue Karten.
    const items = [...session.due, ...session.fresh].map((it) => ({
      card: it.card,
      dir: it.dir,
    }));
    setQueue(items);
    setTotal(items.length);
    setRevealed(false);
    setStats({ learned: 0, again: 0 });
    setPhase("learn");
  };

  const rate = (rating) => {
    if (!current) return;
    const item = current; // aktuelle Karte steht immer vorn (queue[0])
    const key = srsKey(item.card, item.dir);
    const isNew = !state.srs[key];
    // review() pflegt die LANGFRISTIGEN Werte (interval, dueDate) – unverändert.
    const newState = review(state.srs[key], rating);

    setState((s) => ({
      ...s,
      srs: { ...s.srs, [key]: newState },
      log: bumpLog(
        isNew ? bumpLog(s.log, today, "newCards") : s.log,
        today,
        "reviews"
      ),
    }));

    // Session-interne Reihenfolge anpassen (rein positionsbasiert):
    setQueue((q) => {
      const rest = q.slice(1); // vorderste (aktuelle) Karte herausnehmen
      if (rating === RATINGS.good || rating === RATINGS.easy) {
        // Gut/Einfach: Karte verlässt die laufende Session.
        return rest;
      }
      // Nochmal/Schwer: ein paar Positionen weiter wieder einreihen, damit man
      // die Karte schnell – aber nicht sofort – noch einmal sieht.
      const gap =
        rating === RATINGS.again
          ? randInt(AGAIN_GAP_MIN, AGAIN_GAP_MAX)
          : randInt(HARD_GAP_MIN, HARD_GAP_MAX);
      // Sind weniger Karten übrig als die Einfügeposition, landet die Karte am
      // Ende (splice hängt bei zu großem Index automatisch hinten an).
      const idx = Math.min(gap, rest.length);
      rest.splice(idx, 0, item);
      return rest;
    });

    setStats((t) => ({
      learned:
        t.learned +
        (rating === RATINGS.good || rating === RATINGS.easy ? 1 : 0),
      again: t.again + (rating === RATINGS.again ? 1 : 0),
    }));
    setRevealed(false);
  };

  // Tastatursteuerung: Sobald eine Karte aufgedeckt ist, bewerten die Tasten
  // 1–4 die Karte (1 Nochmal, 2 Schwer, 3 Gut, 4 Einfach). Mit Leertaste/Enter
  // lässt sich eine verdeckte Karte aufdecken.
  useEffect(() => {
    if (phase !== "learn" || !current) return;
    const keyToRating = {
      1: RATINGS.again,
      2: RATINGS.hard,
      3: RATINGS.good,
      4: RATINGS.easy,
    };
    const onKey = (e) => {
      // In Eingabefeldern nicht eingreifen.
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (!revealed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      const rating = keyToRating[e.key];
      if (rating) {
        e.preventDefault();
        rate(rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, current, revealed, rate]);

  // Optional: Aussprache beim Aufdecken automatisch abspielen. Greift nur,
  // wenn der Nutzer es aktiviert hat — und da das Aufdecken selbst per Klick/
  // Taste passiert, ist die für iOS nötige Nutzerinteraktion gegeben.
  useEffect(() => {
    if (revealed && settings.autoSpeak && current?.card.hanzi) {
      speech.speak(current.card.hanzi);
    }
    // Nur beim Wechsel von zu/aufgedeckt bzw. neuer Karte auslösen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, current]);

  if (phase === "setup") {
    return (
      <div className="space-y-5">
        <DeckPicker
          decks={settings.decks}
          onDecks={(d) => updateSettings({ decks: d })}
          directions={settings.directions}
          onDirections={(d) => updateSettings({ directions: d })}
          includeProperNames={settings.includeProperNames}
          onIncludeProperNames={(v) => updateSettings({ includeProperNames: v })}
          onlyHighlighted={settings.onlyHighlighted}
          onOnlyHighlighted={(v) => updateSettings({ onlyHighlighted: v })}
        />
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          Neue Karten pro Tag:
          <input
            type="number"
            min="0"
            max="100"
            value={settings.newPerDay}
            onChange={(e) =>
              updateSettings({ newPerDay: Number(e.target.value) || 0 })
            }
            className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={settings.autoSpeak}
            disabled={!speech.available}
            onChange={(e) => updateSettings({ autoSpeak: e.target.checked })}
            className="h-4 w-4"
          />
          Aussprache beim Aufdecken automatisch abspielen
          {!speech.available && !speech.loading && (
            <span className="text-xs text-zinc-400">(keine Stimme)</span>
          )}
        </label>
        <div className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {session.due.length} fällig
          </span>
          {" · "}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {session.fresh.length} neu
          </span>
          {" · "}
          <span className="text-zinc-500">{pool.length} Karten im Deck</span>
        </div>
        <button
          onClick={start}
          disabled={session.due.length + session.fresh.length === 0}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Session starten
        </button>
        {session.due.length + session.fresh.length === 0 && (
          <p className="text-center text-sm text-zinc-500">
            Nichts zu lernen — wähle weitere Decks oder komm morgen wieder. 🎉
          </p>
        )}
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-5xl">🎉</p>
        <h2 className="text-xl font-bold">Session geschafft!</h2>
        <p className="text-zinc-500">
          {stats.learned} Karten gelernt, {stats.again}× „Nochmal" gebraucht.
        </p>
        <button
          onClick={() => setPhase("setup")}
          className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  // Queue leer → der Effekt oben schaltet gleich auf "done"; bis dahin nichts
  // rendern (verhindert Zugriff auf eine nicht vorhandene Karte).
  if (!current) return null;

  // ---- Lernansicht ----
  const { card, dir } = current;
  const ivs = previewIntervals(state.srs[srsKey(card, dir)]);
  const radicalHits = card.type === "vocab" ? radicalsInWord(card.hanzi) : [];

  // Vorderseite je nach Richtung
  const front =
    dir === "mh" ? (
      <p className="text-2xl">{card.meaning}</p>
    ) : (
      <p className="hanzi text-6xl leading-tight">{card.hanzi}</p>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Karte {Math.min(stats.learned + 1, total)} von {total}
        </span>
        <span>
          {card.lesson} · {DIRECTIONS[dir].label}
        </span>
      </div>

      <div
        onClick={() => !revealed && setRevealed(true)}
        className={`relative flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800 ${
          !revealed ? "hover:border-emerald-400" : ""
        }`}
      >
        {/* Markierung aus dem Original (gelb = prüfungsrelevant) */}
        <ExamBadge card={card} className="absolute left-3 top-3" />
        {front}
        {revealed && (
          <>
            <hr className="w-1/2 border-zinc-200 dark:border-zinc-600" />
            {dir !== "mh" && (
              <div className="flex items-center gap-2">
                {card.pinyin && (
                  <p className="text-xl text-emerald-600 dark:text-emerald-400">
                    {card.pinyin}
                  </p>
                )}
                <SpeakButton text={card.hanzi} speech={speech} />
              </div>
            )}
            {dir === "mh" && (
              <>
                <p className="hanzi text-6xl leading-tight">{card.hanzi}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl text-emerald-600 dark:text-emerald-400">
                    {card.pinyin}
                  </p>
                  <SpeakButton text={card.hanzi} speech={speech} />
                </div>
              </>
            )}
            {dir !== "hp" && dir !== "mh" && (
              <p className="text-2xl">{card.meaning}</p>
            )}
            {dir === "hp" && (
              <p className="text-lg text-zinc-400">{card.meaning}</p>
            )}
            <p className="text-xs text-zinc-400">
              {card.wordClass}
              {card.type === "radical" && ` · Radikal Nr. ${card.number}`}
              {card.variants?.length > 0 &&
                ` · Varianten: ${card.variants.join(", ")}`}
            </p>
            {radicalHits.length > 0 && (
              <p className="text-xs text-zinc-400">
                Radikale im Wort:{" "}
                {radicalHits
                  .map((r) => `${r.radical} (${r.meaning})`)
                  .join(", ")}
              </p>
            )}
            {!speech.available && !speech.loading && (
              <p className="text-xs text-zinc-400">
                Keine chinesische Stimme installiert — unter iOS-Einstellungen
                &gt; Bedienungshilfen &gt; Gesprochene Inhalte hinzufügbar.
              </p>
            )}
          </>
        )}
        {!revealed && (
          <p className="mt-4 text-sm text-zinc-400">Tippen zum Aufdecken</p>
        )}
      </div>

      {revealed && (
        <div className="grid grid-cols-4 gap-2">
          {[
            // Nochmal/Schwer bleiben in der Session: Beschriftung zeigt jetzt
            // den Positionsabstand statt einer (irreführenden) Minutenangabe.
            ["Nochmal", RATINGS.again, "bg-rose-600 hover:bg-rose-700", `in ${AGAIN_GAP_MIN}–${AGAIN_GAP_MAX} Karten`, 1],
            ["Schwer", RATINGS.hard, "bg-amber-600 hover:bg-amber-700", `in ${HARD_GAP_MIN}–${HARD_GAP_MAX} Karten`, 2],
            ["Gut", RATINGS.good, "bg-emerald-600 hover:bg-emerald-700", ivs.good, 3],
            ["Einfach", RATINGS.easy, "bg-sky-600 hover:bg-sky-700", ivs.easy, 4],
          ].map(([label, r, cls, iv, num]) => (
            <button
              key={label}
              onClick={() => rate(r)}
              className={`relative rounded-xl py-3 text-sm font-semibold text-white transition-colors ${cls}`}
            >
              <span className="absolute right-1.5 top-1 text-[10px] font-normal opacity-70">
                {num}
              </span>
              {label}
              <span className="block text-[10px] font-normal opacity-80">
                {iv}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
