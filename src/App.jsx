// Hauptkomponente: hält den App-Zustand (localStorage) und schaltet
// zwischen den fünf Bereichen um. Bewusst ohne Router-Bibliothek —
// für eine lokale Single-Page-App reicht einfacher State.
import { useEffect, useState } from "react";
import { useAppState } from "./lib/store";
import { useCloudSync } from "./lib/sync";
import Dashboard from "./components/Dashboard";
import Flashcards from "./components/Flashcards";
import Quiz from "./components/Quiz";
import RadicalTrainer from "./components/RadicalTrainer";
import Writing from "./components/Writing";
import VocabList from "./components/VocabList";
import Grammar from "./components/Grammar";
import SyncBar from "./components/SyncBar";

const TABS = [
  { id: "dashboard", label: "Übersicht", icon: "📊" },
  { id: "learn", label: "Lernen", icon: "🎴" },
  { id: "quiz", label: "Quiz", icon: "❓" },
  { id: "grammar", label: "Grammatik", icon: "语" },
  { id: "vocab", label: "Wörter", icon: "📋" },
  { id: "radicals", label: "Radikale", icon: "部" },
  { id: "writing", label: "Schreiben", icon: "✍️" },
];

export default function App() {
  const [state, setState] = useAppState();
  const sync = useCloudSync(state, setState);
  const [tab, setTab] = useState("dashboard");

  // Dunkler Modus: Klasse am <html>-Element setzen (siehe index.css)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.dark);
  }, [state.settings.dark]);

  const toggleDark = () =>
    setState((s) => ({
      ...s,
      settings: { ...s.settings, dark: !s.settings.dark },
    }));

  // Lernfortschritt zurücksetzen: srs (Karten-Zustände) und log (Tages-
  // aktivität/Streak) leeren, Einstellungen (Decks, Dark-Mode, …) behalten.
  // Wichtig bei aktiver Cloud-Sync: den geleerten Stand sofort hochladen,
  // damit der nächste Login-Merge nicht den alten Cloud-Stand zurückspielt.
  const resetProgress = () => {
    const fresh = { ...state, srs: {}, log: {}, grammar: {}, updatedAt: Date.now() };
    setState(() => fresh);
    sync.pushNow(fresh);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      {/* Kopfzeile */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">
            <span className="hanzi mr-1.5 text-emerald-600 dark:text-emerald-400">
              汉字
            </span>
            Lern-App
          </h1>
          <button
            onClick={toggleDark}
            className="rounded-full p-2 text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Hell/Dunkel umschalten"
          >
            {state.settings.dark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* Sync-Leiste: Login (Magic Link), Status, Speichern, Abmelden */}
      <SyncBar sync={sync} />

      {/* Inhalt */}
      <main className="mx-auto max-w-xl px-4 py-5 pb-24">
        {tab === "dashboard" && (
          <Dashboard state={state} onReset={resetProgress} />
        )}
        {tab === "learn" && <Flashcards state={state} setState={setState} />}
        {tab === "quiz" && <Quiz state={state} setState={setState} />}
        {tab === "grammar" && <Grammar state={state} setState={setState} />}
        {tab === "vocab" && <VocabList state={state} setState={setState} />}
        {tab === "radicals" && <RadicalTrainer />}
        {tab === "writing" && <Writing state={state} />}
      </main>

      {/* Untere Navigation (mobile-first) */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                tab === t.id
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              <span className="hanzi text-lg leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
