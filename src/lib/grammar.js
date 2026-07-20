// Grammatik-Verwaltung: lädt die 48 Themen (grammar.json) fürs Nachschlagen
// und stellt Hilfsfunktionen bereit: Gruppierung/Suche, tolerante Antwort-
// prüfung fürs Üben, Auswahl schwacher Themen (Fehlerquote > 30 %) sowie die
// Brücke zum Übungsgenerator (grammarGen.js), der alle Aufgaben zur Laufzeit
// frisch aus Satz-Templates baut – es gibt keine gespeicherten Aufgaben mehr.
//
// Der Grammatik-Fortschritt liegt im App-State unter `state.grammar` als
// { [topicId]: { correct, wrong } } – gleiches Speicher-/Sync-Konzept wie der
// restliche Lernstand (siehe store.js).
import topics from "../data/grammar.json";
import {
  generateTopicSet,
  generateMixedSet,
  buildGeneratedExam,
  formatsForTopic,
} from "./grammarGen";

export const GRAMMAR_TOPICS = topics;

// Lektions-Gruppen in Kursreihenfolge (fürs Nachschlagen und die Fortschritts-
// übersicht). Entspricht den `lektion`-Werten in grammar.json.
export const LESSON_ORDER = ["Lek 1–3", "Lek 4", "Lek 5", "Lek 6"];

export const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));

// Themen nach Lektion gruppiert (in Kursreihenfolge).
export function topicsByLesson() {
  return LESSON_ORDER.map((lektion) => ({
    lektion,
    topics: topics.filter((t) => t.lektion === lektion),
  }));
}

// Freitextsuche über Titel, Struktur, Erklärung und Beispiele (Zeichen/Pinyin/
// Deutsch). Case-insensitiv; chinesische Zeichen matchen direkt.
export function searchTopics(query) {
  const q = query.trim().toLowerCase();
  if (!q) return topics;
  return topics.filter((t) => {
    const hay = [
      t.titel,
      t.struktur,
      t.erklaerung,
      t.merke ?? "",
      ...t.beispiele.flatMap((b) => [b.zeichen, b.pinyin, b.deutsch]),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

// --- Antwortprüfung ------------------------------------------------------

// Für den Vergleich Leerzeichen und Interpunktion (chinesisch wie lateinisch)
// entfernen, lateinische Buchstaben kleinschreiben. So werden Selbsteingaben
// tolerant geprüft: „这条裤子太贵了。“ == „这条裤子 太贵了“.
const STRIP = /[\s。，、．？！：；·…“”‘’"'（）()《》〈〉「」【】,.?!:;~—–\-_]/g;

export function normalizeHanzi(s) {
  return (s ?? "").replace(STRIP, "").toLowerCase();
}

// Automatisch prüfbare Formate: Lückentext, Reihenfolge, Wort einsetzen,
// Übersetzung, Fehlerkorrektur, Umformung. Für die offenen Formate (Frage
// stellen/beantworten) gibt es keine eindeutige Lösung – dort wird im UI die
// Musterlösung gezeigt und der Nutzer bewertet sich selbst.
export const AUTO_CHECK_FORMATS = [
  "lueckentext",
  "reihenfolge",
  "wort_einsetzen",
  "uebersetzung",
  "fehler",
  "umformung",
];
export const SELF_CHECK_FORMATS = ["frage_beantworten", "frage_stellen"];

export function isAutoCheck(ex) {
  return AUTO_CHECK_FORMATS.includes(ex.format);
}

// Prüft eine Antwort. `answer` ist für Lückentext ein Array (ein Wert je Lücke),
// sonst ein String (bei Reihenfolge/Wort-einsetzen der zusammengesetzte Satz).
// Der Generator liefert bei mehreren gültigen Wortstellungen (z. B. Zeitangabe
// vor oder nach dem Subjekt) zusätzlich `alternativen` – die zählen auch.
export function checkAnswer(ex, answer) {
  if (ex.format === "lueckentext") {
    if (!Array.isArray(answer)) return false;
    return (
      answer.length === ex.loesungen.length &&
      answer.every((a, i) => normalizeHanzi(a) === normalizeHanzi(ex.loesungen[i]))
    );
  }
  const norm = normalizeHanzi(answer);
  if (norm === normalizeHanzi(ex.loesung)) return true;
  return (ex.alternativen ?? []).some((alt) => norm === normalizeHanzi(alt));
}

// --- Fortschritt ---------------------------------------------------------

// Fehlerquote eines Themas (0..1). Ohne Versuche: null.
export function errorRate(stat) {
  const total = (stat?.correct ?? 0) + (stat?.wrong ?? 0);
  if (!total) return null;
  return stat.wrong / total;
}

// Themen mit Fehlerquote > Schwelle (Standard 30 %) – werden beim gemischten
// Üben bevorzugt gezogen. Nur Themen mit mindestens einem Versuch zählen.
export function weakTopicIds(grammar = {}, threshold = 0.3) {
  return topics
    .map((t) => t.id)
    .filter((id) => {
      const r = errorRate(grammar[id]);
      return r != null && r > threshold;
    });
}

// --- Übungs- und Prüfungsaufbau (alles frisch generiert) ------------------

// Aufgaben für EIN Thema: rotiert durch alle Formate, die das Thema anbietet.
export const TOPIC_SET_LENGTH = 8;
export function buildTopicPractice(topicId) {
  return generateTopicSet(topicId, TOPIC_SET_LENGTH);
}

// Gemischtes Üben über die gewählten Themen; schwache Themen (Fehlerquote
// > 30 %) werden vom Generator doppelt gewichtet.
export function buildMixedPractice(topicIds, grammar, count) {
  return generateMixedSet(topicIds, weakTopicIds(grammar), count);
}

// Probeklausur im Stil von Probeklausur_1_Lek4-6.pdf – Aufgabenblöcke je
// Format mit Punktevergabe, alle Aufgaben frisch generiert.
export function buildExam(topicIds) {
  return buildGeneratedExam(topicIds);
}

// Wie viele Aufgabenformate ein Thema anbietet (für die Anzeige im Setup).
export { formatsForTopic };
