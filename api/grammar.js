// Serverless-Proxy (Vercel Function) für die KI-Grammatikübungen ("Modus B").
//
// WARUM ein Proxy? Die App ist reines Frontend – ein Anthropic-API-Key darf
// niemals ins gebaute JS-Bundle, sonst könnte ihn jeder aus den Browser-
// DevTools auslesen. Diese Funktion läuft serverseitig auf Vercel, hält den
// Key als Env-Var (ANTHROPIC_API_KEY) und reicht die Anfrage an Anthropic
// durch. Der Browser sieht nur diesen Endpunkt, nie den Key.
//
// Schutz: Weil der Endpunkt öffentlich erreichbar ist (jeder, der die Deploy-
// URL kennt, könnte ihn aufrufen und so Kosten verursachen), akzeptiert die
// Funktion nur Anfragen von eingeloggten Nutzern. Der Client schickt sein
// Supabase-Access-Token im Authorization-Header; die Funktion prüft es gegen
// Supabase, bevor sie Anthropic anruft. Ist Supabase nicht konfiguriert
// (lokale Entwicklung ohne .env), entfällt die Prüfung.
//
// Env-Vars auf Vercel:
//   ANTHROPIC_API_KEY            – Pflicht, geheim (ohne VITE_-Präfix!)
//   GRAMMAR_MODEL               – optional, Standard "claude-opus-4-8"
//   VITE_SUPABASE_URL           – für die Login-Prüfung (schon vorhanden)
//   VITE_SUPABASE_ANON_KEY      – dito
import Anthropic from "@anthropic-ai/sdk";

// Anthropic 4.8: temperature/top_p/top_k und budget_tokens werden mit 400
// abgelehnt – wir senden sie bewusst NICHT (der KI-Prompt-Entwurf nannte
// temperature 0.2–0.4, das gilt für ältere Modelle). Modus B braucht ein
// starkes Modell, weil viele Sätze auf einmal korrekt sein müssen.
const MODEL = process.env.GRAMMAR_MODEL || "claude-opus-4-8";

// --------------------------------------------------------------------------
// System-Prompt (Modus B). Anders als im ursprünglichen Entwurf lassen wir die
// KI die Aufgaben direkt im internen Format der App ausgeben (Feldnamen wie im
// lokalen Generator), damit clientseitig kaum umgeschlüsselt werden muss.
// --------------------------------------------------------------------------
const SYSTEM_PROMPT = `Du erstellst Grammatikübungen für eine Chinesisch-Lern-App (vereinfachte Zeichen, Deutsch als Erklärungssprache). Du bekommst ein Grammatikthema mit Struktur und Beispielsätzen sowie eine begrenzte Liste erlaubter Vokabeln.

Regeln:
1. Verwende ausschließlich Wörter aus der mitgelieferten Wortliste plus allgemeine Funktionswörter der Standardgrammatik (的, 了, 和, 不, 没, 在, 是, 有, Pronomen, Zahlen, Zähleinheitswörter). Erfinde keine anderen Vokabeln.
2. Baue nur Sätze, die inhaltlich Sinn ergeben (kein "im Supermarkt schlafen"). Passt aus der Wortliste kein sinnvoller Satz zur Struktur, liefere für diese Aufgabe kein Ergebnis statt eines erzwungenen, unsinnigen Satzes.
3. Beachte Tonsandhi: 不 wird zu bú vor viertem Ton, 一 wird zu yí vor viertem Ton oder vor 个, sonst yì (außer bei Datumsangaben wie 一月).
4. Zähleinheitswörter müssen zum Nomen passen. Ist im Wortlisten-Eintrag ein "measureWord" angegeben, benutze exakt dieses.
5. Deutsche Übersetzungen sind grammatisch korrekt konjugiert/dekliniert, keine Wort-für-Wort-Übersetzung.
6. Pinyin steht mit Tonzeichen und passt exakt zu den Schriftzeichen (Silbenzahl = Zeichenzahl, Tonsandhi berücksichtigt).
7. Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Text davor oder danach, ohne Markdown-Codeblöcke. Jedes Element folgt genau einem der folgenden Schemas (je nach angefragtem Format):

lueckentext:
{ "format": "lueckentext", "frage": string, "satz": string (Lücke als "___"), "loesungen": [string], "optionen": [[string,string,string,string]] (je Lücke die richtige Lösung + 3 plausible Distraktoren, gemischt), "loesung": string (vollständiger Satz), "pinyin": string, "deutsch": string }

reihenfolge:
{ "format": "reihenfolge", "frage": string, "tokens": [string] (die Wörter/Bausteine des Satzes, gemischt), "loesung": string (vollständiger Satz), "alternativen": [string], "pinyin": string, "deutsch": string }

wort_einsetzen:
{ "format": "wort_einsetzen", "frage": string, "basis": [string] (der Satz als Bausteine OHNE das einzusetzende Wort), "wort": string (das einzusetzende Wort), "loesung": string (vollständiger Satz), "alternativen": [string], "pinyin": string, "deutsch": string }

uebersetzung:
{ "format": "uebersetzung", "frage": "Übersetze ins Chinesische (Schriftzeichen).", "deutsch": string (der zu übersetzende deutsche Satz), "loesung": string (chinesische Zeichen), "alternativen": [string], "pinyin": string }

fehler:
{ "format": "fehler", "frage": string, "falsch": string (Satz mit genau einem Grammatikfehler), "loesung": string (korrigierter Satz), "hinweis": string (welche Regel verletzt wurde), "pinyin": string (zum korrigierten Satz), "deutsch": string }

umformung:
{ "format": "umformung", "frage": string (Anweisung, z. B. "Forme in eine 吗-Frage um"), "quelle": string (Ausgangssatz), "loesung": string (umgeformter Satz), "alternativen": [string], "pinyin": string (zur Lösung), "deutsch": string }

frage_beantworten:
{ "format": "frage_beantworten", "frage": "Beantworte die Frage mit Schriftzeichen.", "antwortFrage": string (die zu beantwortende chinesische Frage), "loesung": string (Musterantwort), "pinyin": string, "deutsch": string }

frage_stellen:
{ "format": "frage_stellen", "frage": "Stelle die passende Frage.", "gegebeneAntwort": string (die chinesische Antwort), "loesung": string (passende Frage), "pinyin": string, "deutsch": string }

Lässt sich zu einem angefragten Format keine sinnvolle Aufgabe aus der Wortliste bauen, lasse dieses Element im Array einfach weg. Lieber weniger Aufgaben als eine falsche.`;

// --------------------------------------------------------------------------
// Login-Prüfung: Supabase-Access-Token gegen /auth/v1/user verifizieren.
// Gibt true zurück, wenn kein Supabase konfiguriert ist (lokal) oder das Token
// zu einem gültigen Nutzer gehört.
// --------------------------------------------------------------------------
async function isAuthorized(req) {
  const supaUrl = process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY;
  // Ohne Supabase-Konfiguration keine Gatekeeping-Möglichkeit → durchlassen
  // (nur relevant für lokale Entwicklung ohne .env).
  if (!supaUrl || !supaKey) return true;

  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;

  try {
    const r = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: supaKey, Authorization: `Bearer ${token}` },
    });
    return r.ok; // 200 = gültiges Token, sonst 401
  } catch {
    return false;
  }
}

// Rohtext der Modellantwort einsammeln (nur Text-Blöcke) und als JSON parsen.
// Robust gegen versehentliche ```json-Codeblöcke.
function parseExercises(message) {
  const text = (message.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  const arr = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(arr) ? arr : [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Nur POST erlaubt." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "KI nicht konfiguriert (kein API-Key)." });
  }
  if (!(await isAuthorized(req))) {
    return res.status(401).json({ error: "Anmeldung erforderlich." });
  }

  // Vercel parst JSON-Bodies automatisch, je nach Runtime aber nicht immer –
  // deshalb defensiv beide Fälle behandeln.
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Ungültiger JSON-Body." });
    }
  }
  const { thema, formate, anzahlProFormat = 2, wortliste } = body || {};
  if (!thema || !Array.isArray(formate) || !formate.length || !Array.isArray(wortliste)) {
    return res.status(400).json({ error: "thema, formate und wortliste sind erforderlich." });
  }

  const userPayload = { thema, formate, anzahlProFormat, wortliste };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Kein thinking/temperature: für Opus 4.8 würden temperature/top_p/top_k
    // einen 400 auslösen; ohne thinking-Feld läuft das Modell ohne Denkphase,
    // was die JSON-Ausgabe sauber und schnell hält.
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(userPayload) }],
    });

    if (message.stop_reason === "refusal") {
      return res.status(422).json({ error: "Anfrage abgelehnt." });
    }
    const exercises = parseExercises(message);
    return res.status(200).json({ exercises });
  } catch (err) {
    // Anthropic-SDK wirft typisierte Fehler mit .status – für die App reicht
    // eine grobe Einordnung; der Client fällt ohnehin auf den lokalen
    // Generator zurück.
    const status = err?.status ?? 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "KI-Anfrage fehlgeschlagen.",
    });
  }
}

// Vercel: der Aufruf an Anthropic kann einige Sekunden dauern – Timeout hoch
// setzen, damit die Funktion nicht vorzeitig abbricht.
export const config = { maxDuration: 60 };
