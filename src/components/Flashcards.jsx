// Flashcard-Lernen mit Spaced Repetition.
// Ablauf: Setup (Decks/Richtungen wählen) → Session (erst fällige
// Wiederholungen, dann neue Karten) → Zusammenfassung.
//
// Session-Warteschlange: Jede Karte trägt einen session-internen
// Fälligkeitszeitpunkt `dueAt` (Zeitstempel). "Gut"/"Einfach" schieben die
// Karte um Tage weiter → sie verlässt die Session. "Nochmal"/"Schwer" setzen
// `dueAt` auf 2 bzw. 15 Minuten → die Karte bleibt in der Session und kommt
// wieder dran, sobald ihre Zeit gekommen ist. Die Session endet erst, wenn
// keine Karte mehr übrig ist.
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

export default function Flashcards({ state, setState }) {
  const { settings } = state;
  const speech = useSpeech();
  const [phase, setPhase] = useState("setup"); // setup | learn | done
  // Warteschlange: Einträge { card, dir, dueAt } — dueAt = Zeitstempel, ab wann
  // die Karte in der Session wieder dran ist.
  const [queue, setQueue] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ learned: 0, again: 0 });
  // Tickt im Wartezustand, damit fällig werdende Karten erscheinen und der
  // Countdown läuft.
  const [now, setNow] = useState(() => Date.now());

  const pool = useMemo(
    () =>
      buildPool(
        settings.decks,
        settings.includeProperNames,
        settings.onlyHighlighted
      ),
    [settings.decks, settings.includeProperNames, settings.onlyHighlighted]
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

  // Aktuelle Karte = früheste bereits fällige Karte (dueAt <= now).
  // Ist keine fällig, merken wir uns den nächsten Fälligkeitszeitpunkt für den
  // Countdown im Wartezustand.
  const { current, currentIndex, nextDueAt } = useMemo(() => {
    let curIdx = -1;
    let soonest = Infinity;
    for (let i = 0; i < queue.length; i++) {
      const it = queue[i];
      if (it.dueAt <= now) {
        if (curIdx === -1 || it.dueAt < queue[curIdx].dueAt) curIdx = i;
      } else if (it.dueAt < soonest) {
        soonest = it.dueAt;
      }
    }
    return {
      current: curIdx >= 0 ? queue[curIdx] : null,
      currentIndex: curIdx,
      nextDueAt: soonest,
    };
  }, [queue, now]);

  // Im Wartezustand (Karten in der Warteschlange, aber noch keine fällig)
  // jede Sekunde neu prüfen.
  useEffect(() => {
    if (phase !== "learn" || current || queue.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase, current, queue.length]);

  // Session ist vorbei, sobald keine Karte mehr in der Warteschlange ist.
  useEffect(() => {
    if (phase === "learn" && queue.length === 0) setPhase("done");
  }, [phase, queue.length]);

  const updateSettings = (patch) =>
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const start = () => {
    const startAt = Date.now();
    const items = [...session.due, ...session.fresh].map((it) => ({
      card: it.card,
      dir: it.dir,
      dueAt: startAt, // alle sofort verfügbar; Reihenfolge: fällig vor neu
    }));
    setQueue(items);
    setRevealed(false);
    setStats({ learned: 0, again: 0 });
    setNow(startAt);
    setPhase("learn");
  };

  const rate = (rating) => {
    if (!current) return;
    const item = current;
    const key = srsKey(item.card, item.dir);
    const isNew = !state.srs[key];
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

    setQueue((q) => {
      if (rating === RATINGS.good || rating === RATINGS.easy) {
        // Intervall in Tagen → Karte verlässt die Session.
        return q.filter((_, j) => j !== currentIndex);
      }
      // Nochmal/Schwer: in der Session lassen, neue Wiedervorlage in 2/15 Min.
      const next = [...q];
      next[currentIndex] = { ...next[currentIndex], dueAt: newState.dueDate };
      return next;
    });

    setStats((t) => ({
      learned:
        t.learned +
        (rating === RATINGS.good || rating === RATINGS.easy ? 1 : 0),
      again: t.again + (rating === RATINGS.again ? 1 : 0),
    }));
    setRevealed(false);
    setNow(Date.now());
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

  // ---- Wartezustand: alle übrigen Karten sind noch nicht wieder fällig ----
  if (!current) {
    const secs = Math.max(0, Math.ceil((nextDueAt - now) / 1000));
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl">⏳</p>
        <h2 className="text-lg font-semibold">Kurze Pause</h2>
        <p className="text-zinc-500">
          Die nächste Wiederholung ist in{" "}
          <span className="font-mono font-semibold">
            {mm}:{ss}
          </span>{" "}
          fällig.
        </p>
        <p className="text-sm text-zinc-400">
          Noch {queue.length} {queue.length === 1 ? "Karte" : "Karten"} in dieser
          Session.
        </p>
      </div>
    );
  }

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
          Noch {queue.length} {queue.length === 1 ? "Karte" : "Karten"}
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
            ["Nochmal", RATINGS.again, "bg-rose-600 hover:bg-rose-700", ivs.again, 1],
            ["Schwer", RATINGS.hard, "bg-amber-600 hover:bg-amber-700", ivs.hard, 2],
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
