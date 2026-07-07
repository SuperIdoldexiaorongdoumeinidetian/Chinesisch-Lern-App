# Hanzi-Lern-App — Projektdokumentation

Lokale, installierbare Web-App (PWA) zum Lernen chinesischer Vokabeln und
Schriftzeichen. Grundlage sind die Kaishi!-Kursvokabeln (Lek 1–6 + Zusatzteile),
der komplette **HSK-Wortschatz (Standard 3.0)** und die 201 Radikale.

Der Nutzer ist kein erfahrener Entwickler — bei wichtigen Entscheidungen kurz das
**Warum** erklären. UI und Inhalte sind auf **Deutsch**.

## Tech-Stack

- **React 19 + Vite 6**, reines Frontend, kein eigenes Backend
- **Tailwind CSS 4** (via `@tailwindcss/vite`)
- **hanzi-writer** für Strichreihenfolge und Schreibübungen (lädt Zeichendaten
  pro Zeichen aus dem CDN — als einziges Feature nicht offline-fähig)
- **vite-plugin-pwa**: installierbar (iOS-Homescreen), Service Worker cacht die
  App-Shell für Offline-Start. Das JS-Bundle enthält den kompletten Wortschatz,
  daher ist das Workbox-Cache-Limit auf 6 MiB angehoben (siehe `vite.config.js`).
- **Supabase** für optionale geräteübergreifende Synchronisation des Lernstands
- Persistenz lokal über **localStorage**; Supabase liegt als Sync-Schicht darüber

## Projektstruktur

```
src/
  data/
    vocab.json      ← 1068 Kaishi!-Vokabeln (aus dem Kurs-PDF extrahiert)
    hsk.json        ← 10.990 HSK-Vokabeln (HSK1–HSK6 + HSK7-9)
    radicals.json   ← 201 Radikale
    vocab.backup.json ← Sicherung der Extraktion
  lib/
    deck.js         ← Karten-/Deck-Aufbau, Session-Logik, Quiz-Optionen
    srs.js          ← Spaced-Repetition-Algorithmus (Anki-angelehnt, KEIN SM-2)
    store.js        ← localStorage-Persistenz, Merge-Logik, Streak/Tageslog
    sync.js         ← Supabase-Cloud-Sync (useCloudSync-Hook)
    supabase.js     ← Supabase-Client (aus VITE_-Env-Vars)
    pinyin.js       ← Pinyin-Vergleich (Tonzeichen ↔ Ton-Zahlen)
    speech.js       ← Aussprache über Web Speech API
  components/
    Dashboard.jsx   ← Statistik/Übersicht        Flashcards.jsx ← SRS-Lernen
    Quiz.jsx        ← Quiz-Modi                   RadicalTrainer.jsx
    Writing.jsx     ← Schreibtraining             DeckPicker.jsx ← Deck-Auswahl
    SyncBar.jsx     ← Login/Sync-Status           SpeakButton, ExamBadge
  App.jsx           ← Navigation (5 Tabs), dunkler Modus, Fortschritt-Reset
scripts/extract_highlights.py ← Extraktion der Markierungen aus dem PDF
```

## Datenmodell

Vokabel-Einträge (`vocab.json` **und** `hsk.json`, gleiches Schema):

- `hanzi` — vereinfachte Zeichen (z. B. "电话")
- `pinyin` — mit Tonzeichen (z. B. "diànhuà")
- `meaning` — deutsche Bedeutung (Kaishi!) bzw. englische (HSK-Quelle)
- `wordClass` — Substantiv, Verb, Adjektiv, Adverb, Pronomen, Zählwort,
  Partikel, Fragewort, Konjunktion, Redemittel, …
- `lesson` — Kaishi!: "1-1"…"6-3", "Schriftzeichen", "Kouyu";
  HSK: "HSK1"…"HSK6", "HSK7-9"
- `isProperName` — Eigennamen (Personennamen) sind standardmäßig vom Lernen
  ausgeschlossen; Länder/Städte wie 中国 zählen **nicht** als Eigenname
- `meaningSource` — "ergänzt" (im Kaishi!-PDF fehlte die Bedeutung) oder "hsk"
- `highlighted` / `highlightColor` — im Kaishi!-Original farbig markiert.
  **Prüfungsrelevant** = gelb `#FFFF00` (siehe `isExamRelevant` in `deck.js`);
  darüber filtert der Schalter „nur prüfungsrelevante Vokabeln".

Radikale (`radicals.json`): `number` (1–201), `radical`, `variants` (z. B. ["氵"]
bei 水), `meaning` (deutsch), `strokes`.

Warum HSK in einer eigenen Datei? Damit sich Kurs- und HSK-Wortschatz getrennt
pflegen und als getrennte Deck-Gruppen auswählen lassen. In `deck.js` werden
beide Quellen zu einem Kartenpool zusammengeführt; die Karten-ID
`lesson|hanzi|wordClass` bleibt dank der HSK-eigenen Lektionsnamen eindeutig.

## Kernkonzepte

**Karten & Decks** (`deck.js`): Jede Vokabel wird pro Abfragerichtung zu einer
Karte. Drei Richtungen: `hm` (Hanzi→Bedeutung), `mh` (Bedeutung→Hanzi),
`hp` (Hanzi→Pinyin). Decks = Lektionen/HSK-Level/„Radikale" (Mehrfachauswahl).
SRS-Schlüssel = `card.id|direction`.

**Spaced Repetition** (`srs.js`): **Kein SM-2 mehr.** Jede Karte hat ein
`interval` (ganze Tage). Vier Bewertungen: Nochmal / Schwer / Gut / Einfach.
Gut ×2,5, Einfach ×3,5; Nochmal und Schwer setzen das Intervall auf 0 zurück
(Nochmal zählt zusätzlich als Lapse). Kurzfristige Wiedervorlagen innerhalb der
Session laufen über die Position in der Queue (Nochmal → +2 min, Schwer → +15 min).
`normalizeCardState` migriert alte Stände (auch das frühere SM-2-Format) beim Laden.

**Session-Aufbau** (`buildSession`): erst fällige Wiederholungen (älteste zuerst),
dann neue Karten bis zum Tageslimit (Standard 10/Tag).

**Persistenz & Merge** (`store.js`): gesamter Lernstand unter einem
localStorage-Schlüssel. `mergeStates` führt lokal + Cloud verlustfrei zusammen —
`srs`: jüngeres `lastReviewed` gewinnt; `log`: Maximum je Tagesfeld; `settings`:
jüngeres `updatedAt` gewinnt.

**Cloud-Sync** (`sync.js` + `supabase.js`): Login per Magic Link. Beim Login wird
der Cloud-Stand geladen und **gemergt** (nie überschrieben), Änderungen werden
debounced (3 s) hochgeladen, offline wird gepuffert. Ohne `VITE_`-Env-Vars läuft
die App rein lokal weiter (`supabaseConfigured === false`). Schutz über Row Level
Security auf der Supabase-Tabelle `progress`. Deployment-Details siehe Memory
`supabase-sync-deployment`.

## Die fünf Bereiche (Tabs in `App.jsx`)

| Tab | Inhalt |
|---|---|
| **Übersicht** | Gelernte Karten, heute fällig, Streak, Fortschritt pro Lektion/Level, Reviews der letzten 30 Tage |
| **Lernen** | Flashcards mit SRS; Decks, Richtungen, Tageslimit, Eigennamen-Toggle, „nur prüfungsrelevant" |
| **Quiz** | Multiple Choice (Hanzi↔Bedeutung, Distraktoren bevorzugt aus derselben Lektion) + Pinyin-Texteingabe mit Ton-Zahlen (`dian4hua4`). Ändert den Lernstand nicht |
| **Radikale** | Radikal→Bedeutung als Multiple Choice, nach Strichzahl filterbar, mit Nachschlage-Liste. Auch als eigenes Deck im Lernen verfügbar |
| **Schreiben** | Strichreihenfolge ansehen/nachzeichnen (hanzi-writer), mehrsilbig Zeichen für Zeichen |

## Entwicklung

```bash
npm install        # nur beim ersten Mal
npm run dev        # Dev-Server (http://localhost:5173), --host fürs Handy
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal testen
```

Für Cloud-Sync eine `.env` mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`
anlegen (ohne läuft die App lokal).

## Datenqualität (bei Änderungen an den JSON-Daten beachten)

- Kaishi!-Vokabeln wurden aus einem Tabellen-PDF über Koordinaten rekonstruiert
  und Seite für Seite geprüft; 585 Bedeutungen sind `"ergänzt"` (im PDF fehlten
  sie). Doppelte Wörter mit unterschiedlicher Wortart sind bewusst getrennte Karten.
- Korrigierte PDF-Tippfehler u. a.: 便宜 piányi (nicht „biànyi"), 好吃 hǎochī,
  桔子水 júzishuǐ, 还可以 hái kěyǐ, 空儿 kòngr. Radikal Nr. 169 (im PDF durch
  Schriftart-Problem fehlend) als **㫃** ergänzt.
- Neue Lektionen/Level: einfach an die passende JSON-Datei anhängen. Neue
  HSK-Level oder Deck-Gruppen zusätzlich in `LESSONS`/`HSK_LESSONS` in `deck.js`
  eintragen.

## Arbeitsweise

- Sauberer, **kommentierter** Code auf Deutsch (siehe bestehende Dateien —
  Kommentare erklären das „Warum") — der Nutzer will ihn nachvollziehen und erweitern.
- Nach größeren Änderungen kurz erklären, was gebaut wurde und wie man es testet.
- Bei Unklarheit nachfragen statt raten.
