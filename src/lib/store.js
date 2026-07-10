// Persistenz über localStorage: Der gesamte Lernstand liegt unter einem
// einzigen Schlüssel als JSON. localStorage überlebt Browser-Neustarts,
// gilt aber nur für diesen Browser auf diesem Gerät.
import { useEffect, useState } from "react";
import { normalizeCardState } from "./srs";

const KEY = "hanzi-lern-app-v1";

const DEFAULT_STATE = {
  // SRS-Zustand pro Karte+Richtung, z. B. "1-1|电话|Substantiv|hm" → {ef, interval, ...}
  srs: {},
  // Aktivität pro Tag: { "2026-06-12": { reviews: 12, newCards: 5 } }
  log: {},
  // Angepasste Wörterlisten pro Lektion (nur geänderte Lektionen gespeichert).
  customVocab: {},
  // Zeitpunkt der letzten lokalen Änderung (ms). Dient beim geräteübergreifenden
  // Merge als Tie-Break für die Einstellungen (jüngerer Stand gewinnt).
  updatedAt: 0,
  settings: {
    dark: false,
    newPerDay: 10,
    includeProperNames: false,
    directions: ["hm"], // hm = Hanzi→Bedeutung, mh = Bedeutung→Hanzi, hp = Hanzi→Pinyin
    decks: ["1-1"], // ausgewählte Lektionen / "Radikale"
    autoSpeak: false, // Aussprache beim Aufdecken automatisch abspielen
    onlyHighlighted: false, // nur prüfungsrelevante (im Original gelb markierte) Vokabeln
  },
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    // Jeden gespeicherten Kartenzustand auf das aktuelle SRS-Schema migrieren
    // (alte SM-2-Felder umrechnen, fehlende Felder mit Defaults ergänzen).
    const srs = {};
    for (const [k, v] of Object.entries(parsed.srs ?? {})) {
      const normalized = normalizeCardState(v);
      if (normalized) srs[k] = normalized;
    }
    // Defaults mit gespeichertem Stand zusammenführen (für spätere Updates)
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      srs,
      customVocab: parsed.customVocab ?? {},
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  // Beim Speichern den Änderungszeitstempel mitschreiben, damit ein anderes
  // Gerät beim Merge erkennt, welcher Einstellungsstand jünger ist.
  const stamped = { ...state, updatedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(stamped));
}

// React-Hook: Zustand laden, bei jeder Änderung automatisch speichern.
export function useAppState() {
  const [state, setState] = useState(loadState);
  useEffect(() => saveState(state), [state]);
  return [state, setState];
}

// Führt zwei Lernstände zusammen (lokal + aus der Cloud geladen), ohne dass
// Fortschritt verloren geht. Strategie:
//  - srs (pro Karte+Richtung): der Eintrag mit dem jüngeren lastReviewed gewinnt.
//  - log (pro Tag): je Feld das Maximum behalten (Aktivität geht nie verloren).
//  - settings: vom Stand mit dem jüngeren updatedAt übernehmen.
// Reihenfolge der Argumente ist egal – das Ergebnis ist immer dasselbe.
export function mergeStates(a, b) {
  if (!a) return b;
  if (!b) return a;

  // --- srs: jüngere Bewertung pro Schlüssel gewinnt ---
  const srs = { ...a.srs };
  for (const [k, vb] of Object.entries(b.srs ?? {})) {
    const va = srs[k];
    if (!va || (vb?.lastReviewed ?? 0) > (va?.lastReviewed ?? 0)) srs[k] = vb;
  }

  // --- log: pro Tag das jeweils höhere Zähler-Maximum ---
  const log = { ...a.log };
  for (const [day, rb] of Object.entries(b.log ?? {})) {
    const ra = log[day];
    log[day] = ra
      ? {
          reviews: Math.max(ra.reviews ?? 0, rb.reviews ?? 0),
          newCards: Math.max(ra.newCards ?? 0, rb.newCards ?? 0),
        }
      : rb;
  }

  // --- settings + updatedAt: jüngerer Gesamtstand gewinnt ---
  const aNewer = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0);
  const settings = aNewer ? a.settings : b.settings;
  const customVocab = (aNewer ? a : b).customVocab ?? {};
  const updatedAt = Math.max(a.updatedAt ?? 0, b.updatedAt ?? 0);

  return { srs, log, settings, customVocab, updatedAt };
}

// Hilfsfunktion: Tageseintrag im Log erhöhen.
export function bumpLog(log, date, field, by = 1) {
  const day = log[date] ?? { reviews: 0, newCards: 0 };
  return { ...log, [date]: { ...day, [field]: (day[field] ?? 0) + by } };
}

// Streak = Anzahl aufeinanderfolgender Tage mit mindestens 1 Review,
// gezählt rückwärts ab heute (heute ohne Review zählt noch nicht als Bruch).
export function calcStreak(log, today) {
  let streak = 0;
  const d = new Date(today);
  if (!log[today]?.reviews) d.setDate(d.getDate() - 1); // heute noch nichts gelernt → ab gestern zählen
  for (;;) {
    const key = d.toLocaleDateString("sv-SE");
    if (log[key]?.reviews > 0) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}
