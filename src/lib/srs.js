// Eigener, an Anki angelehnter Spaced-Repetition-Algorithmus.
//
// Kerngedanke: Jede Karte hat ein "interval" (Abstand in ganzen Tagen,
// 0 = neu oder zurückgesetzt). Bei richtigen Antworten wächst das Intervall
// immer weiter (Gut × 2,5 / Einfach × 3,5), bis man "Schwer" (Pause ohne
// Wachstum) oder "Nochmal" (Reset auf 0) drückt. Kurzfristige Wiedervorlagen
// innerhalb der Session laufen über Minuten statt Tage.

// Bewertungen der vier Buttons (Strings statt Zahlen — der frühere
// SM-2-Qualitätswert 0-5 wird nicht mehr gebraucht).
export const RATINGS = {
  again: "again", // Nochmal  (rot)
  hard: "hard", //   Schwer   (orange)
  good: "good", //   Gut      (grün)
  easy: "easy", //   Einfach  (blau)
};

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Kurzintervalle für die session-interne Wiedervorlage.
export const AGAIN_DELAY_MS = 2 * MIN_MS; //  Nochmal → in 2 Minuten
export const HARD_DELAY_MS = 15 * MIN_MS; //  Schwer  → in 15 Minuten

// Frischer Kartenzustand: interval 0, noch nie fällig gewesen, keine Lapses,
// noch nie bewertet (lastReviewed = null).
export function emptyCardState() {
  return { interval: 0, dueDate: null, lapses: 0, lastReviewed: null };
}

// Datum als "YYYY-MM-DD" (lokale Zeitzone) — für Tageslog und Streak.
export function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("sv-SE"); // sv-SE liefert ISO-Format
}

// Migriert/normalisiert einen gespeicherten Kartenzustand auf das neue Schema
// { interval, dueDate, lapses }. Versteht auch das alte SM-2-Format
// ({ ef, interval, reps, lapses, due:"YYYY-MM-DD" }) und ergänzt fehlende
// Felder mit Defaults — so geht beim App-Update kein Lernstand verloren.
export function normalizeCardState(state) {
  if (!state) return null; // noch nie gelernt → bleibt "frisch"
  const interval = Number.isFinite(state.interval) ? state.interval : 0;
  const lapses = Number.isFinite(state.lapses) ? state.lapses : 0;

  let dueDate = Number.isFinite(state.dueDate) ? state.dueDate : null;
  if (dueDate === null && typeof state.due === "string") {
    // Alt-Format: Datumsstring → Zeitstempel (lokale Mitternacht des Tages).
    const t = Date.parse(`${state.due}T00:00:00`);
    if (!Number.isNaN(t)) dueDate = t;
  }
  // Zeitpunkt der letzten Bewertung – Grundlage für den geräteübergreifenden
  // Merge (neuerer Zeitstempel gewinnt). Alte Stände ohne dieses Feld bekommen
  // null und verlieren damit gegen jede echte Bewertung von einem anderen Gerät.
  const lastReviewed = Number.isFinite(state.lastReviewed)
    ? state.lastReviewed
    : null;
  return { interval, dueDate, lapses, lastReviewed };
}

// Nächstes Intervall (in Tagen) bei "Gut": 0→1, 1→3, sonst ×2,5 gerundet.
function nextGoodInterval(interval) {
  if (interval <= 0) return 1;
  if (interval === 1) return 3;
  return Math.round(interval * 2.5);
}

// Nächstes Intervall (in Tagen) bei "Einfach": 0→2, ≤2→7, sonst ×3,5 gerundet.
function nextEasyInterval(interval) {
  if (interval <= 0) return 2;
  if (interval <= 2) return 7;
  return Math.round(interval * 3.5);
}

// Wendet eine Bewertung auf den Kartenzustand an und gibt den neuen Zustand
// zurück. `now` ist injizierbar (für Tests); Default ist die aktuelle Zeit.
export function review(state, rating, now = Date.now()) {
  const s = normalizeCardState(state) ?? emptyCardState();

  switch (rating) {
    case RATINGS.again:
      // Kompletter Reset, in 2 Minuten erneut fällig.
      return { interval: 0, dueDate: now + AGAIN_DELAY_MS, lapses: s.lapses + 1, lastReviewed: now };

    case RATINGS.hard:
      // Intervall bleibt unverändert; nur kurze Pause (15 Min) in der Session.
      return { interval: s.interval, dueDate: now + HARD_DELAY_MS, lapses: s.lapses, lastReviewed: now };

    case RATINGS.good: {
      const interval = nextGoodInterval(s.interval);
      return { interval, dueDate: now + interval * DAY_MS, lapses: s.lapses, lastReviewed: now };
    }

    case RATINGS.easy: {
      const interval = nextEasyInterval(s.interval);
      return { interval, dueDate: now + interval * DAY_MS, lapses: s.lapses, lastReviewed: now };
    }

    default:
      return s;
  }
}

// Formatiert eine Zeitspanne (in ms) als Button-Beschriftung:
// unter 1 Stunde → Minuten, unter 1 Tag → Stunden, sonst → Tage.
export function formatDelay(ms) {
  if (ms < 60 * MIN_MS) {
    const min = Math.max(1, Math.round(ms / MIN_MS));
    return `${min} Min`;
  }
  if (ms < DAY_MS) {
    const hours = Math.round(ms / (60 * MIN_MS));
    return `${hours} Std`;
  }
  const days = Math.round(ms / DAY_MS);
  return `${days} ${days === 1 ? "Tag" : "Tage"}`;
}

// Vorschau: welcher Abstand würde bei jedem der vier Buttons angewendet?
// (für die kleinen Beschriftungen unter den Buttons)
export function previewIntervals(state) {
  const s = normalizeCardState(state) ?? emptyCardState();
  return {
    again: formatDelay(AGAIN_DELAY_MS),
    hard: formatDelay(HARD_DELAY_MS),
    good: formatDelay(nextGoodInterval(s.interval) * DAY_MS),
    easy: formatDelay(nextEasyInterval(s.interval) * DAY_MS),
  };
}
