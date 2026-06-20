// Schmale Leiste unter der Kopfzeile: Login per Magic Link, Sync-Status,
// "Jetzt speichern" und Abmelden. Wird mit den Werten aus useCloudSync versorgt.
import { useState } from "react";

// Anzeige-Text + Farbe je Sync-Status.
const STATUS = {
  loading: { text: "Lade…", cls: "text-zinc-400" },
  saving: { text: "Speichere…", cls: "text-amber-600 dark:text-amber-400" },
  synced: { text: "Synchronisiert ✓", cls: "text-emerald-600 dark:text-emerald-400" },
  offline: {
    text: "Offline — wird später synchronisiert",
    cls: "text-zinc-500 dark:text-zinc-400",
  },
  error: { text: "Sync-Fehler — erneut versuchen", cls: "text-rose-600 dark:text-rose-400" },
};

export default function SyncBar({ sync }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // Ohne Supabase-Konfiguration (keine .env) bleibt die App rein lokal.
  if (!sync.configured) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const err = await sync.signIn(email.trim());
    setSending(false);
    if (err) setError(err.message || "Senden fehlgeschlagen");
    else setSent(true);
  };

  // --- Nicht eingeloggt: Login-Formular -----------------------------------
  if (!sync.user) {
    return (
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
        <div className="mx-auto max-w-xl">
          {sent ? (
            <p className="text-center text-sm text-emerald-600 dark:text-emerald-400">
              📧 Link gesendet an <span className="font-medium">{email}</span> —
              öffne ihn auf diesem Gerät, um dich anzumelden.
            </p>
          ) : (
            <form onSubmit={submit} className="flex items-center gap-2">
              <span className="hidden text-sm text-zinc-500 sm:inline">
                Geräteübergreifend synchronisieren:
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.de"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <button
                type="submit"
                disabled={sending}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {sending ? "…" : "Anmelden"}
              </button>
            </form>
          )}
          {error && (
            <p className="mt-1 text-center text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Eingeloggt: Status + Aktionen --------------------------------------
  const s = STATUS[sync.status] ?? STATUS.synced;
  return (
    <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 text-sm">
        <span className={`min-w-0 truncate ${s.cls}`} title={sync.email}>
          {s.text}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={sync.saveNow}
            disabled={sync.status === "saving"}
            className="text-zinc-500 hover:text-emerald-600 disabled:opacity-50 dark:hover:text-emerald-400"
            title="Jetzt speichern"
          >
            Jetzt speichern
          </button>
          <button
            onClick={sync.signOut}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            title={`Angemeldet als ${sync.email}`}
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
