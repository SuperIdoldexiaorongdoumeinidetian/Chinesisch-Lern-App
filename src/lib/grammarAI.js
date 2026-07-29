// KI-Grammatikübungen ("Modus B"): erweitert den lokalen Generator um Aufgaben
// mit dem großen Kaishi-Wortschatz. Der lokale Generator (grammarGen.js) baut
// Sätze bewusst nur aus kuratierten Pools (~100–150 Wörter) und ist damit
// garantiert korrekt, aber begrenzt in der Abwechslung. Dieses Modul schickt
// ein Grammatikthema samt einer kleinen, rotierenden Wortliste an den
// Serverless-Proxy (/api/grammar), der es an die Claude-API weiterreicht, und
// prüft die zurückgelieferten Aufgaben clientseitig, bevor sie ins UI kommen.
//
// Grundhaltung wie beim lokalen Generator: lieber eine Aufgabe verwerfen als
// eine falsche anzeigen. Bei fehlendem Login, fehlendem Key oder Netzfehler
// liefert dieses Modul einfach ein leeres Array – der Aufrufer fällt dann auf
// den lokalen Generator zurück.
import vocab from "../data/vocab.json";
import { supabase, supabaseConfigured } from "./supabase";
import { normalizeHanzi } from "./grammar";
import { topicById } from "./grammar";
import { formatsForTopic } from "./grammarGen";

// Die KI-Übungen werden im UI nur angeboten, wenn Supabase (und damit der Login
// als Missbrauchsschutz des Proxys) konfiguriert ist. Ohne Login kann der
// öffentliche Endpunkt sonst fremde Kosten verursachen.
export const AI_AVAILABLE = supabaseConfigured;

// Alle acht Formate, die die KI liefern kann (deckungsgleich mit dem lokalen
// Generator). Wir schränken pro Anfrage auf die Formate ein, die das Thema
// laut Template-Konfiguration unterstützt.
const AI_FORMATS = [
  "lueckentext", "reihenfolge", "wort_einsetzen", "uebersetzung",
  "fehler", "umformung", "frage_beantworten", "frage_stellen",
];

// Punkte je Format – gleiche Gewichtung wie im lokalen Generator.
const PUNKTE = { uebersetzung: 2, fehler: 2, umformung: 2 };

let aiCounter = 0; // für eindeutige Aufgaben-IDs (React-key)

// --------------------------------------------------------------------------
// Wortliste bauen: kleine, thematisch passende Auswahl (20–30 Wörter) aus
// vocab.json. Nicht den ganzen Wortschatz mitschicken – das wäre teuer und die
// Trefferquote sänke, weil das Modell aus zu vielen Möglichkeiten frei
// kombinieren müsste. Gefiltert nach den Lektionen der Themen-Lektion, ohne
// Eigennamen; Einträge mit subClass/measureWord werden bevorzugt.
// --------------------------------------------------------------------------

// "Lek 1–3" → ["1","2","3"], "Lek 4" → ["4"] usw. (der Bindestrich ist ein
// Halbgeviertstrich „–", nicht „-").
function lessonPrefixes(lektion) {
  const nums = (lektion.match(/\d+/g) || []).map(Number);
  if (nums.length === 2) {
    const range = [];
    for (let n = nums[0]; n <= nums[1]; n++) range.push(String(n));
    return range;
  }
  return nums.map(String);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildWortliste(topic, size = 26) {
  const prefixes = lessonPrefixes(topic.lektion);
  const pool = vocab.filter(
    (e) =>
      !e.isProperName &&
      prefixes.some((p) => e.lesson.startsWith(p + "-") || e.lesson === p)
  );
  // Einträge mit subClass/measureWord zuerst (dem Modell helfen ZEW & Kategorie),
  // dann zufällig auffüllen.
  const rich = shuffle(pool.filter((e) => e.subClass || e.measureWord));
  const rest = shuffle(pool.filter((e) => !e.subClass && !e.measureWord));
  return [...rich, ...rest].slice(0, size).map((e) => {
    const w = {
      hanzi: e.hanzi,
      pinyin: e.pinyin,
      meaning: e.meaning,
      wordClass: e.wordClass,
    };
    if (e.subClass) w.subClass = e.subClass;
    if (e.measureWord) w.measureWord = e.measureWord;
    return w;
  });
}

// --------------------------------------------------------------------------
// Netz: eine Anfrage an den Proxy. Gibt das rohe exercises-Array zurück (oder
// [] bei jedem Fehler – der Aufrufer fällt dann auf den lokalen Generator).
// --------------------------------------------------------------------------
async function callProxy(payload) {
  const headers = { "Content-Type": "application/json" };
  // Access-Token mitschicken, damit der Proxy den Login prüfen kann.
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch("/api/grammar", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json.exercises) ? json.exercises : [];
}

// --------------------------------------------------------------------------
// Validierung & Normalisierung: rohe KI-Aufgabe → interne Aufgaben-Form (wie
// der lokale Generator), oder null bei Verstoß. Analog zu den vielen
// `return null`-Stellen im lokalen Generator: im Zweifel verwerfen.
// --------------------------------------------------------------------------
function normalizeAIExercise(raw, topic) {
  if (!raw || !AI_FORMATS.includes(raw.format)) return null;
  if (!raw.loesung || !raw.pinyin) return null;

  // Formatspezifische Pflichtfelder + Plausibilität prüfen.
  switch (raw.format) {
    case "lueckentext": {
      if (!Array.isArray(raw.loesungen) || !raw.loesungen.length) return null;
      if (typeof raw.satz !== "string") return null;
      const luecken = raw.satz.split("___").length - 1;
      if (luecken !== raw.loesungen.length) return null;
      // Optionen: je Lücke 4 Stück, die richtige Lösung muss dabei sein.
      if (!Array.isArray(raw.optionen) || raw.optionen.length !== raw.loesungen.length)
        return null;
      for (let i = 0; i < raw.loesungen.length; i++) {
        const opts = raw.optionen[i];
        if (!Array.isArray(opts) || opts.length !== 4) return null;
        if (!opts.some((o) => normalizeHanzi(o) === normalizeHanzi(raw.loesungen[i])))
          return null;
      }
      break;
    }
    case "reihenfolge": {
      if (!Array.isArray(raw.tokens) || raw.tokens.length < 2) return null;
      // Die gemischten Bausteine müssen zusammen den Lösungssatz ergeben.
      if (normalizeHanzi(raw.tokens.join("")) !== normalizeHanzi(raw.loesung))
        return null;
      break;
    }
    case "wort_einsetzen": {
      if (!Array.isArray(raw.basis) || !raw.basis.length || !raw.wort) return null;
      // Lösung = Basis-Bausteine + eingesetztes Wort (Position egal).
      const stripped = normalizeHanzi(raw.loesung).replace(normalizeHanzi(raw.wort), "");
      if (stripped !== normalizeHanzi(raw.basis.join(""))) return null;
      break;
    }
    case "uebersetzung":
      if (!raw.deutsch) return null;
      break;
    case "fehler":
      if (!raw.falsch || normalizeHanzi(raw.falsch) === normalizeHanzi(raw.loesung))
        return null;
      break;
    case "umformung":
      if (!raw.quelle) return null;
      break;
    case "frage_beantworten":
      if (!raw.antwortFrage) return null;
      break;
    case "frage_stellen":
      if (!raw.gegebeneAntwort) return null;
      break;
    default:
      return null;
  }

  // Interne Zusatzfelder ergänzen (id, topicId, punkte, erklaerung …).
  return {
    ...raw,
    id: `ai-${topic.id}-${raw.format}-${++aiCounter}`,
    topicId: topic.id,
    lektion: topic.lektion,
    punkte: PUNKTE[raw.format] ?? 1,
    erklaerung: `Thema ${topic.id} „${topic.titel}“ – Struktur: ${topic.struktur}. (KI-Übung)`,
    // hinweis nur bei "fehler" relevant; sonst harmlos undefiniert.
    hinweis: raw.hinweis,
    alternativen: Array.isArray(raw.alternativen) ? raw.alternativen : [],
  };
}

// Aufgaben für EIN Thema von der KI holen (bereits geprüft & normalisiert).
async function fetchAITopic(topicId, { anzahlProFormat = 2, maxFormate = 4 } = {}) {
  const topic = topicById[topicId];
  if (!topic) return [];
  // Nur Formate anfragen, die das Thema unterstützt (Schnittmenge mit AI_FORMATS).
  const formate = shuffle(formatsForTopic(topicId).filter((f) => AI_FORMATS.includes(f)))
    .slice(0, maxFormate);
  if (!formate.length) return [];

  const payload = {
    thema: {
      id: topic.id,
      titel: topic.titel,
      struktur: topic.struktur,
      erklaerung: topic.erklaerung,
      beispiele: topic.beispiele,
    },
    formate,
    anzahlProFormat,
    wortliste: buildWortliste(topic),
  };

  let raw = [];
  try {
    raw = await callProxy(payload);
  } catch {
    return []; // Netzfehler → lokaler Fallback beim Aufrufer
  }
  return raw.map((r) => normalizeAIExercise(r, topic)).filter(Boolean);
}

// --------------------------------------------------------------------------
// Öffentliche API (vom UI genutzt), spiegelt die lokalen build*-Funktionen.
// --------------------------------------------------------------------------

// Übungsset für EIN Thema.
export async function buildAITopicPractice(topicId, count = 8) {
  const items = await fetchAITopic(topicId, { anzahlProFormat: 3 });
  return shuffle(items).slice(0, count);
}

// Gemischtes Set über mehrere Themen. Um Kosten/Latenz zu begrenzen, werden
// höchstens drei Themen (parallel) angefragt; das Ergebnis wird gemischt und
// auf `count` gekürzt.
export async function buildAIMixedPractice(topicIds, count = 12) {
  const chosen = shuffle(topicIds).slice(0, 3);
  const batches = await Promise.all(chosen.map((id) => fetchAITopic(id, { anzahlProFormat: 2 })));
  return shuffle(batches.flat()).slice(0, count);
}
