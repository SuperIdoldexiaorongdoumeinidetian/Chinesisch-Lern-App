// Supabase-Client: eine einzige, app-weit geteilte Instanz.
//
// Die Zugangsdaten kommen aus Umgebungsvariablen (.env, VITE_-Präfix), damit
// sie nicht im Quellcode stehen. Der anon-/Publishable-Key ist bewusst
// öffentlich – der eigentliche Schutz liegt in der Row Level Security der
// Tabelle "progress" (jeder Nutzer sieht nur seine eigene Zeile).
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ist die App ohne Supabase-Konfiguration gebaut, läuft sie weiter rein lokal
// (localStorage). So bleibt die App auch ohne .env nutzbar.
export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: {
        // Session im localStorage halten und automatisch erneuern, damit man
        // eingeloggt bleibt und sich nicht ständig neu anmelden muss.
        persistSession: true,
        autoRefreshToken: true,
        // Den Magic-Link-Token aus der URL automatisch verarbeiten, wenn man
        // über den Link in der E-Mail zurückkommt.
        detectSessionInUrl: true,
      },
    })
  : null;
