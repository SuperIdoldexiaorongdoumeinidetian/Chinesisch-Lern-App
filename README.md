# Hanzi-Lern-App (Kaishi! Lek 1–6 + Radikale)

Lokale Web-App zum Lernen der Vokabeln und Schriftzeichen aus dem Kurs
(Lehrbuch „Kaishi!", Lektionen 1–6, plus Schriftzeichen-Teil, Kouyu-Vokabeln
und die 201 Radikale).

## Starten

```bash
npm install   # nur beim ersten Mal
npm run dev
```

Dann die angezeigte Adresse im Browser öffnen (normalerweise
http://localhost:5173). Die App ist mobile-first — am Handy einfach die
IP-Adresse des Rechners verwenden (`npm run dev -- --host`).

**Hinweis:** Das Schreibtraining lädt die Strichreihenfolge-Daten pro Zeichen
aus dem Internet (CDN von hanzi-writer). Alles andere funktioniert offline.

## Die fünf Bereiche

| Tab | Was er macht |
|---|---|
| **Übersicht** | Gelernte Karten, heute fällige Wiederholungen, Streak, Fortschritt pro Lektion, Reviews der letzten 30 Tage |
| **Lernen** | Flashcards mit Spaced Repetition (SM-2 wie bei Anki). Decks und Kartenrichtungen wählbar, Eigennamen standardmäßig ausgeschlossen, neue Karten pro Tag begrenzt (Standard 10) |
| **Quiz** | Multiple Choice (Hanzi→Bedeutung, Bedeutung→Hanzi) und Pinyin-Texteingabe mit Ton-Zahlen (`dian4hua4`). Beeinflusst den Lernstand nicht |
| **Radikale** | Radikal→Bedeutung als Multiple Choice, nach Strichzahl filterbar, mit Nachschlage-Liste. Radikale sind außerdem als eigenes Deck „Radikale" im Flashcard-Lernen verfügbar |
| **Schreiben** | Strichreihenfolge ansehen oder nachzeichnen (Maus/Finger), bei mehrsilbigen Wörtern Zeichen für Zeichen |

Der Lernstand liegt im **localStorage des Browsers** — er bleibt beim
Schließen erhalten, gilt aber nur für diesen Browser auf diesem Gerät.

## Projektstruktur

```
src/
  data/vocab.json      ← 1068 Vokabeln aus dem Vokabel-PDF
  data/radicals.json   ← 201 Radikale aus der Radikalliste
  lib/srs.js           ← SM-2-Algorithmus (Spaced Repetition)
  lib/store.js         ← localStorage-Persistenz, Streak, Tageslog
  lib/pinyin.js        ← Pinyin-Vergleich (Tonzeichen ↔ Ton-Zahlen)
  lib/deck.js          ← Deck-Aufbau, Session-Logik, Quiz-Optionen
  components/          ← die fünf Ansichten + Deck-Auswahl
  App.jsx              ← Navigation, dunkler Modus
```

## Datenextraktion — bitte stichprobenartig prüfen

Die PDFs sind Tabellen-Layouts; die Zuordnung Wort → Lektion → Wortart wurde
über die Koordinaten im PDF rekonstruiert und anschließend **Seite für Seite
gegen das gerenderte PDF-Bild geprüft**. Einträge pro Lektion:

| Lektion | Einträge | | Lektion | Einträge |
|---|---|---|---|---|
| 1-1 | 44 | | 4-2 | 39 |
| 1-2 | 30 | | 4-3 | 10 |
| 1-3 | 22 | | 5-1 | 47 |
| 2-1 | 32 | | 5-2 | 48 |
| 2-2 | 31 | | 5-3 | 25 |
| 2-3 | 24 | | 6-1 | 40 |
| 3-1 | 42 | | 6-2 | 46 |
| 3-2 | 35 | | 6-3 | 44 |
| 3-3 | 38 | | Schriftzeichen | 188 |
| 4-1 | 44 | | Kouyu | 239 |

Gesamt: **1068 Vokabeln**, davon 59 Eigennamen (Personennamen; Länder und
Städte zählen absichtlich nicht dazu). **585 Einträge** tragen
`"meaningSource": "ergänzt"` — dort stand im PDF keine deutsche Bedeutung,
sie wurde ergänzt. Diese lohnen sich für Stichproben gegen das Lehrbuch.

Wörter, die im PDF doppelt vorkommen (z. B. 工作 als Substantiv *und* Verb,
还是 in Lek 2-1 und 6-1), sind bewusst als separate Karten erhalten.

### Korrigierte PDF-Fehler

Einige offensichtliche Tippfehler des PDFs wurden korrigiert:

- 便宜 „biànyi" → **piányi** (Standardlesung)
- 好吃 „hào chī" → **hǎochī**
- 桔子水 „jiézǐshuǐ" → **júzishuǐ**
- 还可以 „huán kěyǐ" → **hái kěyǐ**
- 空儿 „kōng'r" → **kòngr**
- „Bembus" → Bambus, „Afrike" → Afrika, „Schirmps" → Shrimps usw.

Bei den Radikalen fehlte im PDF das Zeichen für Nr. 169 (Schriftart-Problem);
es wurde gemäß der 201er-Liste des 现代汉语词典 als **㫃** ergänzt.

## Mögliche Erweiterungen (bei Bedarf einzeln anfragen)

- Audio-Aussprache über die Web Speech API
- Export/Import des Lernstands als JSON-Datei
- Lektion 7+ (neues PDF einfach an `vocab.json` anhängen)
- Echte Zeichen-Zerlegung für „Radikale im Wort" (braucht Komponenten-Daten,
  z. B. aus cjk-decomp); aktuell wird nur erkannt, wenn ein Zeichen des
  Wortes selbst ein Radikal ist
