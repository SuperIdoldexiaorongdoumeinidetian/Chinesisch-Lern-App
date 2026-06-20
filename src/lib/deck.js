// Deck-Logik: macht aus den JSON-Daten "Karten" mit stabiler ID und
// stellt Filterung (Lektionen, Eigennamen) und Sitzungsaufbau bereit.
import vocab from "../data/vocab.json";
import radicals from "../data/radicals.json";

// Alle Lektionen in Lehrbuch-Reihenfolge (für Auswahl-Listen und Statistik).
export const LESSONS = [
  "1-1", "1-2", "1-3", "2-1", "2-2", "2-3",
  "3-1", "3-2", "3-3", "4-1", "4-2", "4-3",
  "5-1", "5-2", "5-3", "6-1", "6-2", "6-3",
  "Schriftzeichen", "Kouyu",
];
export const RADICAL_DECK = "Radikale";

export const DIRECTIONS = {
  hm: { label: "Hanzi → Bedeutung" },
  mh: { label: "Bedeutung → Hanzi" },
  hp: { label: "Hanzi → Pinyin" },
};

// Vokabel-Karten: ID aus Lektion+Hanzi+Wortart (eindeutig, siehe Datenprüfung).
export const vocabCards = vocab.map((e) => ({
  ...e,
  id: `${e.lesson}|${e.hanzi}|${e.wordClass}`,
  type: "vocab",
}));

// Radikal-Karten: eigenes Deck, ohne Pinyin.
export const radicalCards = radicals.map((r) => ({
  id: `R${r.number}`,
  type: "radical",
  hanzi: r.radical,
  pinyin: "",
  meaning: r.meaning,
  wordClass: "Radikal",
  lesson: RADICAL_DECK,
  isProperName: false,
  number: r.number,
  variants: r.variants,
  strokes: r.strokes,
}));

export const allRadicals = radicals;

// "Prüfungsrelevant" = im Originaldokument GELB markiert (#FFFF00). Andere
// Markierungsfarben (z. B. Silber) sind nicht prüfungsrelevant.
export const isExamRelevant = (card) =>
  card.highlighted === true && card.highlightColor === "#FFFF00";

// Karten-Pool für eine Deck-Auswahl zusammenstellen.
// onlyHighlighted: nur prüfungsrelevante Vokabeln (Radikale entfallen dann,
// da sie keine solche Markierung tragen).
export function buildPool(decks, includeProperNames, onlyHighlighted = false) {
  const pool = [];
  for (const c of vocabCards) {
    if (!decks.includes(c.lesson)) continue;
    if (c.isProperName && !includeProperNames) continue;
    if (onlyHighlighted && !isExamRelevant(c)) continue;
    pool.push(c);
  }
  if (decks.includes(RADICAL_DECK) && !onlyHighlighted) pool.push(...radicalCards);
  return pool;
}

// Schlüssel für den SRS-Zustand: Karte + Abfragerichtung.
export const srsKey = (card, dir) => `${card.id}|${dir}`;

// Baut die heutige Lern-Session: erst fällige Wiederholungen, dann neue
// Karten (begrenzt durch das Tageslimit). Radikale haben kein Pinyin,
// deshalb wird die Richtung "hp" für sie übersprungen.
export function buildSession(pool, directions, srs, newLimit, now = Date.now()) {
  const due = [];
  const fresh = [];
  for (const card of pool) {
    for (const dir of directions) {
      if (dir === "hp" && !card.pinyin) continue;
      const st = srs[srsKey(card, dir)];
      if (st && st.dueDate != null) {
        if (st.dueDate <= now) due.push({ card, dir, state: st });
      } else {
        fresh.push({ card, dir, state: null });
      }
    }
  }
  // Fällige nach Fälligkeit (älteste zuerst), neue in Datenreihenfolge.
  due.sort((a, b) => a.state.dueDate - b.state.dueDate);
  return { due, fresh: fresh.slice(0, Math.max(0, newLimit)) };
}

// Zufällige Auswahl von n Elementen (für Quiz-Distraktoren).
export function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Multiple-Choice-Optionen: 3 Distraktoren, bevorzugt aus derselben Lektion.
export function mcOptions(card, pool, field) {
  const others = pool.filter((c) => c.id !== card.id && c[field] !== card[field]);
  const sameLesson = others.filter((c) => c.lesson === card.lesson);
  const distractors = sample(sameLesson, 3);
  if (distractors.length < 3) {
    const rest = others.filter((c) => !distractors.includes(c));
    distractors.push(...sample(rest, 3 - distractors.length));
  }
  return sample([card, ...distractors], 4); // mischen
}

// "Bekannte Radikale im Wort": prüft, ob ein Zeichen des Wortes selbst
// ein Radikal (oder eine Variante davon) ist. Eine echte Zeichen-Zerlegung
// bräuchte zusätzliche Komponenten-Daten — das hier ist die einfache Variante.
export function radicalsInWord(hanzi) {
  const found = [];
  for (const ch of hanzi) {
    const hit = radicals.find(
      (r) => r.radical === ch || r.variants.some((v) => v.startsWith(ch))
    );
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}
