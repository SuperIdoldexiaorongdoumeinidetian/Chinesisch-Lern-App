// Geräteübergreifende Synchronisation des Lernstands über Supabase.
//
// Grundidee: localStorage bleibt der lokale, sofort reaktive Speicher
// (und Offline-Puffer). Dieser Hook legt die Cloud-Synchronisation darüber:
//  - Beim Login wird der Stand aus Supabase geladen und mit dem lokalen
//    Stand GEMERGT (kein Überschreiben) – siehe mergeStates in store.js.
//  - Jede Änderung wird mit kurzer Verzögerung (Debounce) automatisch
//    hochgeladen. Zusätzlich gibt es einen "Jetzt speichern"-Aufruf.
//  - Ohne Verbindung wird lokal weitergelernt; sobald wieder online, wird
//    der ausstehende Stand automatisch hochsynchronisiert.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { mergeStates } from "./store";

const DEBOUNCE_MS = 3000; // 3 s nach der letzten Änderung speichern

// Mögliche Status-Werte für die Anzeige:
// "disabled"  – keine Supabase-Konfiguration (rein lokaler Betrieb)
// "signedout" – nicht eingeloggt
// "loading"   – Stand wird aus der Cloud geladen
// "saving"    – wird gerade hochgeladen
// "synced"    – alles synchronisiert
// "offline"   – keine Verbindung, Änderungen werden gepuffert
// "error"     – Fehler beim Speichern/Laden
export function useCloudSync(state, setState) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(
    supabaseConfigured ? "signedout" : "disabled"
  );
  const [online, setOnline] = useState(() => navigator.onLine);

  // Immer den aktuellsten State greifbar haben, ohne ihn in jede
  // Callback-Abhängigkeit aufnehmen zu müssen.
  const stateRef = useRef(state);
  stateRef.current = state;

  const readyRef = useRef(false); // erst nach dem initialen Laden hochladen
  const pendingRef = useRef(false); // es gibt noch nicht gespeicherte Änderungen
  const timerRef = useRef(null);

  // --- Login-Status beobachten -------------------------------------------
  useEffect(() => {
    if (!supabaseConfigured) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // --- Online/Offline beobachten -----------------------------------------
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // --- Hochladen (Upsert in die eigene Zeile) ----------------------------
  const pushData = useCallback(
    async (data) => {
      if (!supabaseConfigured || !user) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return; // pendingRef bleibt true -> wird beim Online-Sein nachgeholt
      }
      setStatus("saving");
      const { error } = await supabase.from("progress").upsert({
        user_id: user.id,
        data,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error("Supabase-Sync fehlgeschlagen:", error.message);
        setStatus("error");
        return;
      }
      pendingRef.current = false;
      setStatus("synced");
    },
    [user]
  );

  // --- Beim Login: Cloud-Stand laden, mergen, einmal hochsynchronisieren --
  useEffect(() => {
    if (!supabaseConfigured) return;
    if (!user) {
      readyRef.current = false;
      setStatus("signedout");
      return;
    }
    let active = true;
    readyRef.current = false;
    setStatus("loading");
    (async () => {
      const { data, error } = await supabase
        .from("progress")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Supabase-Laden fehlgeschlagen:", error.message);
        setStatus("error");
        return;
      }
      const remote = data?.data ?? null;
      // Lokalen Stand mit dem Cloud-Stand zusammenführen (verlustfrei).
      const merged = remote
        ? mergeStates(stateRef.current, remote)
        : stateRef.current;
      if (remote) setState(() => merged);
      readyRef.current = true;
      pendingRef.current = true;
      // Gemergten Stand zurückschreiben (legt die Zeile beim Erst-Login an).
      await pushData({ ...merged, updatedAt: Date.now() });
    })();
    return () => {
      active = false;
    };
  }, [user, setState, pushData]);

  // --- Auto-Save mit Debounce bei jeder Zustandsänderung -----------------
  useEffect(() => {
    if (!supabaseConfigured || !user || !readyRef.current) return;
    pendingRef.current = true;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      pushData({ ...stateRef.current, updatedAt: Date.now() });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [state, user, pushData]);

  // --- Wieder online: ausstehende Änderungen sofort nachreichen ----------
  useEffect(() => {
    if (!supabaseConfigured || !user) return;
    if (online) {
      if (pendingRef.current && readyRef.current) {
        pushData({ ...stateRef.current, updatedAt: Date.now() });
      }
    } else {
      setStatus("offline");
    }
  }, [online, user, pushData]);

  // --- Öffentliche Aktionen ----------------------------------------------
  // Magic-Link anfordern: Supabase schickt eine E-Mail mit Login-Link.
  const signIn = useCallback(async (email) => {
    if (!supabaseConfigured) return new Error("Supabase nicht konfiguriert");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return error ?? null;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return;
    clearTimeout(timerRef.current);
    readyRef.current = false;
    await supabase.auth.signOut();
  }, []);

  // "Jetzt speichern"-Button: sofort hochladen, ohne auf den Debounce zu warten.
  const saveNow = useCallback(() => {
    clearTimeout(timerRef.current);
    pushData({ ...stateRef.current, updatedAt: Date.now() });
  }, [pushData]);

  // Einen explizit übergebenen Stand sofort in die Cloud schreiben. Wird beim
  // Zurücksetzen des Fortschritts gebraucht: dort muss der geleerte Stand
  // hochgeladen werden, BEVOR der nächste Login-Merge den alten Cloud-Stand
  // zurückspielen könnte. Anders als saveNow wartet dies nicht auf den
  // React-Zustand (der nach setState noch veraltet wäre), sondern nimmt den
  // Stand direkt als Argument. Gibt ein Promise zurück, das nach dem Upload
  // erfüllt ist (no-op ohne Konfiguration/Login).
  const pushNow = useCallback(
    (data) => pushData({ ...data, updatedAt: Date.now() }),
    [pushData]
  );

  return {
    configured: supabaseConfigured,
    user,
    email: user?.email ?? null,
    status,
    online,
    signIn,
    signOut,
    saveNow,
    pushNow,
  };
}
