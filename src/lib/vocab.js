// Vokabular-Verwaltung: Standard-Daten aus den JSON-Dateien und
// benutzerdefinierte Anpassungen pro Lektion (customVocab im App-State).
import vocab from "../data/vocab.json";
import hsk from "../data/hsk.json";

export const KAISHI_LESSONS = [
  "1-1", "1-2", "1-3", "2-1", "2-2", "2-3",
  "3-1", "3-2", "3-3", "4-1", "4-2", "4-3",
  "5-1", "5-2", "5-3", "6-1", "6-2", "6-3",
  "Schriftzeichen", "Kouyu",
];

export const HSK_LESSONS = [
  "HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6", "HSK7-9",
];

export const ALL_VOCAB_LESSONS = [...KAISHI_LESSONS, ...HSK_LESSONS];

export const WORD_CLASSES = [
  "Substantiv", "Verb", "Adjektiv", "Adverb", "Pronomen",
  "Zahlwort", "Zählwort", "Partikel", "Fragewort", "Konjunktion",
  "Redemittel", "Interjektion",
];

// Standard-Wortschatz pro Lektion (Kaishi! aus vocab.json, HSK aus hsk.json).
const DEFAULT_BY_LESSON = Object.fromEntries(
  ALL_VOCAB_LESSONS.map((lesson) => [
    lesson,
    [...vocab, ...hsk].filter((e) => e.lesson === lesson),
  ])
);

export const entryKey = (entry) => `${entry.hanzi}|${entry.wordClass}`;

export function toCard(entry) {
  return {
    ...entry,
    id: `${entry.lesson}|${entry.hanzi}|${entry.wordClass}`,
    type: "vocab",
  };
}

export function getDefaultLesson(lesson) {
  return structuredClone(DEFAULT_BY_LESSON[lesson] ?? []);
}

export function isLessonCustomized(customVocab, lesson) {
  return customVocab?.[lesson] != null;
}

// Effektive Einträge einer Lektion: Anpassung oder Standard.
export function getLessonEntries(lesson, customVocab) {
  const raw = customVocab?.[lesson] ?? getDefaultLesson(lesson);
  return raw.map(toCard);
}

export function buildVocabCards(customVocab = {}) {
  return ALL_VOCAB_LESSONS.flatMap((lesson) =>
    getLessonEntries(lesson, customVocab).filter((e) => !e.hidden)
  );
}

// Vor der ersten Bearbeitung die Standard-Liste in customVocab kopieren.
function ensureLesson(customVocab, lesson) {
  if (customVocab?.[lesson]) {
    return { ...customVocab, [lesson]: [...customVocab[lesson]] };
  }
  return { ...customVocab, [lesson]: getDefaultLesson(lesson) };
}

export function updateLessonEntry(customVocab, lesson, key, patch) {
  const next = ensureLesson(customVocab, lesson);
  next[lesson] = next[lesson].map((e) =>
    entryKey(e) === key ? { ...e, ...patch } : e
  );
  return next;
}

// Einzelnes Wort beim Lernen aus-/einblenden (ohne den Eintrag zu löschen).
export function toggleLessonEntryHidden(customVocab, lesson, key) {
  const next = ensureLesson(customVocab, lesson);
  next[lesson] = next[lesson].map((e) =>
    entryKey(e) === key ? { ...e, hidden: !e.hidden } : e
  );
  return next;
}

export function deleteLessonEntry(customVocab, lesson, key) {
  const next = ensureLesson(customVocab, lesson);
  next[lesson] = next[lesson].filter((e) => entryKey(e) !== key);
  return next;
}

export function addLessonEntry(customVocab, lesson, entry) {
  const next = ensureLesson(customVocab, lesson);
  next[lesson] = [...next[lesson], { ...entry, lesson }];
  return next;
}

// Eine Lektion auf den JSON-Standard zurücksetzen.
export function resetLesson(customVocab, lesson) {
  const next = { ...customVocab };
  delete next[lesson];
  return next;
}

// Alle Anpassungen verwerfen.
export function resetAllLessons() {
  return {};
}
