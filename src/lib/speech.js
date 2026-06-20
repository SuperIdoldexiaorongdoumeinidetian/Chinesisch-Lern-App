// Audio-Aussprache über die im Browser eingebaute Web Speech API.
// Komplett kostenlos und offline — es werden keine externen Dienste genutzt.
//
// Warum eine eigene Datei + Hook? Die Stimmen-Verwaltung hat ein paar
// Eigenheiten (vor allem auf iOS/Safari), die wir an genau einer Stelle
// kapseln, damit jede Komponente nur `speak()` und `available` braucht.
import { useEffect, useState } from "react";

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

// Eine chinesische Stimme aus der Liste heraussuchen. Wir verlassen uns nicht
// allein auf utterance.lang, sondern wählen gezielt eine Stimme mit
// Sprachcode zh-CN / zh_CN (Mandarin, Festland) aus. Notfalls reicht auch eine
// andere zh-Stimme (z. B. zh-TW), Hauptsache überhaupt Chinesisch.
function pickChineseVoice(voices) {
  const norm = (l) => (l || "").toLowerCase().replace("_", "-");
  return (
    voices.find((v) => norm(v.lang) === "zh-cn") ||
    voices.find((v) => norm(v.lang).startsWith("zh")) ||
    null
  );
}

// React-Hook: lädt die Stimmenliste (asynchron, mit voiceschanged-Event),
// cached die gefundene chinesische Stimme und stellt `speak` bereit.
export function useSpeech() {
  // null = noch nicht geladen, false = keine zh-Stimme, Voice = gefunden
  const [voice, setVoice] = useState(null);

  useEffect(() => {
    if (!synth) {
      setVoice(false);
      return;
    }
    // Auf iOS ist getVoices() beim ersten Aufruf oft leer; die Liste kommt
    // erst per "voiceschanged"-Event nach. Wir prüfen beides.
    const load = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) return; // noch nicht da — auf Event warten
      setVoice(pickChineseVoice(voices) ?? false);
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  // Text auf Mandarin vorlesen. Muss aus einer echten Nutzerinteraktion
  // (z. B. Button-Klick) heraus aufgerufen werden — iOS spielt sonst nichts ab.
  const speak = (text) => {
    if (!synth || !voice || !text) return;
    synth.cancel(); // laufende Wiedergabe abbrechen, damit sich nichts überlagert
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || "zh-CN";
    u.rate = 0.8; // etwas verlangsamt, damit die Töne klar hörbar sind
    synth.speak(u);
  };

  return {
    speak,
    // Audio nutzbar, sobald eine chinesische Stimme gefunden wurde.
    available: !!voice,
    // true, solange wir noch nicht wissen, ob eine Stimme existiert.
    loading: voice === null,
  };
}
