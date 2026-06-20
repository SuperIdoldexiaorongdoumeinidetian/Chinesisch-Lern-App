// Pinyin-Hilfsfunktionen: Vergleich von Eingaben mit Tonzeichen-Pinyin.
// Der Nutzer darf Töne als Zahlen schreiben ("dian4hua4" für "diànhuà").

// Zuordnung: akzentuierter Vokal → [Grundvokal, Tonnummer]
const TONE_MAP = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["v", 1], ǘ: ["v", 2], ǚ: ["v", 3], ǜ: ["v", 4],
  ü: ["v", 0],
};

// Zerlegt markiertes Pinyin in (Buchstaben ohne Töne, Tonfolge).
// "diànhuà" → { letters: "dianhua", tones: [4, 4] }
export function parseMarked(pinyin) {
  let letters = "";
  const tones = [];
  for (const ch of pinyin.toLowerCase()) {
    if (TONE_MAP[ch]) {
      letters += TONE_MAP[ch][0];
      if (TONE_MAP[ch][1] > 0) tones.push(TONE_MAP[ch][1]);
    } else if (/[a-z]/.test(ch)) {
      letters += ch;
    }
    // alles andere (Leerzeichen, Apostrophe, Klammern …) wird ignoriert
  }
  return { letters, tones };
}

// Zerlegt Nutzereingabe mit Ton-Zahlen: "dian4hua4" → gleiche Struktur.
export function parseNumbered(input) {
  let letters = "";
  const tones = [];
  for (const ch of input.toLowerCase().replaceAll("ü", "v")) {
    if (/[1-4]/.test(ch)) tones.push(Number(ch));
    else if (/[a-z]/.test(ch)) letters += ch;
    // 0 und 5 (neutraler Ton) sowie Sonderzeichen werden ignoriert
  }
  return { letters, tones };
}

// Vergleicht Nutzereingabe mit dem Ziel-Pinyin.
// Ergebnis: "correct" | "tones" (Buchstaben ok, Töne falsch/fehlend) | "wrong"
export function checkPinyin(input, target) {
  // Auch markierte Eingabe (kopiert/IME) akzeptieren:
  const hasMarks = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(input);
  const inp = hasMarks ? parseMarked(input) : parseNumbered(input);
  const tgt = parseMarked(target);

  if (inp.letters !== tgt.letters) return "wrong";
  const same =
    inp.tones.length === tgt.tones.length &&
    inp.tones.every((t, i) => t === tgt.tones[i]);
  return same ? "correct" : "tones";
}
