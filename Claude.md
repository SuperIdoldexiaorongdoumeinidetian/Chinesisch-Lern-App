# Prompt für Claude Code: Hanzi-Lern-App (Kaishi! Lek 1–6 + Radikale)

**Vorbereitung:** Lege die beiden PDFs (`Vokabeln_Zeichen_Lek_1-6_汉字.pdf` und `Radikalliste_Chinesisch-Deutsch.pdf`) in den Projektordner, bevor du den Prompt abschickst. Claude Code liest sie dann direkt ein.

---

Ich möchte eine Lern-App für chinesische Vokabeln und Schriftzeichen als lokale Web-App bauen. Grundlage sind meine Kursunterlagen, die als PDFs im Projektordner liegen:

1. `Vokabeln_Zeichen_Lek_1-6_汉字.pdf` — Vokabelliste zum Lehrbuch "Kaishi!", gegliedert nach Lektionen (1-1 bis 6-3) plus zwei Zusatzteile ("Aussprache/Pinyin/Schriftzeichen" und Vokabeln aus dem "Intensiver Sprachkurs 口语速成")
2. `Radikalliste_Chinesisch-Deutsch.pdf` — 201 Radikale mit deutschen Bedeutungen, sortiert nach Strichzahl, inkl. Varianten (z. B. 氵→ 水, 亻→ 人)

Ich bin kein erfahrener Entwickler, erkläre mir daher bei wichtigen Entscheidungen kurz das Warum.

## Tech-Stack
- React mit Vite, reines Frontend (kein Backend)
- Tailwind CSS
- Persistenz über localStorage
- Bibliothek "hanzi-writer" (npm) für Strichreihenfolge und Schreibübungen

## Schritt 1: Datenextraktion aus den PDFs
Extrahiere die Vokabeln und Radikale in zwei JSON-Dateien. Das ist die wichtigste Grundlage — zeig mir das Schema und ein paar Beispieleinträge zur Freigabe, bevor du alles extrahierst.

**vocab.json** — pro Eintrag:
- `hanzi` (vereinfachte Zeichen, z. B. "电话")
- `pinyin` (mit Tonzeichen, z. B. "diànhuà")
- `meaning` (deutsche Bedeutung)
- `wordClass` (Substantiv, Verb, Adjektiv, Adverb, Pronomen, Zählwort, Partikel, Fragewort, Konjunktion, Redemittel, …)
- `lesson` (z. B. "1-1", "3-2", "Schriftzeichen", "Kouyu")
- `isProperName` (true/false — Eigennamen wie 王大民, 北京 markieren, damit ich sie vom Lernen ausschließen kann; Länder/Städte wie 中国, 慕尼黑 zählen NICHT als Eigennamen, die will ich lernen)

Wichtig: In den frühen Lektionen fehlen im PDF teils die deutschen Bedeutungen (es steht nur Pinyin). Ergänze die fehlenden Bedeutungen selbst — du kennst dieses Grundvokabular. Markiere ergänzte Einträge mit `"meaningSource": "ergänzt"`, damit ich sie stichprobenartig prüfen kann.

**radicals.json** — pro Eintrag:
- `number` (1–201), `radical` (Zeichen), `variants` (z. B. ["氵"] bei 水), `meaning` (deutsch), `strokes` (Strichzahl)

## Schritt 2: Kernfunktionen

### Flashcards mit Spaced Repetition
- SM-2-Algorithmus (wie Anki), Bewertung mit "Nochmal / Schwer / Gut / Einfach"
- Lern-Decks nach Lektion auswählbar (einzeln oder mehrere, z. B. "Lek 1–3 für die Prüfung"), Radikale als eigenes Deck
- Eigennamen standardmäßig ausgeschlossen, per Toggle zuschaltbar
- Drei Kartenrichtungen wählbar: Hanzi → Bedeutung, Bedeutung → Hanzi, Hanzi → Pinyin
- Tägliche Session: erst fällige Wiederholungen, dann neue Karten (Limit einstellbar, Standard 10/Tag)

### Radikal-Trainer
- Eigener Modus: Radikal → deutsche Bedeutung (Multiple Choice), gefiltert nach Strichzahl
- Bonus, falls machbar: Bei Vokabelkarten anzeigen, welche bekannten Radikale im Zeichen stecken

### Schreibtraining
- hanzi-writer: Strichreihenfolge animiert anzeigen
- Quiz-Modus zum Nachzeichnen mit Maus/Finger; bei mehrsilbigen Wörtern Zeichen für Zeichen

### Quiz-Modi
- Hanzi → Bedeutung und Bedeutung → Hanzi (Multiple Choice, 4 Optionen, Distraktoren bevorzugt aus derselben Lektion)
- Hanzi → Pinyin (Texteingabe, Töne als Zahlen erlaubt, z. B. "dian4hua4")

### Fortschritt & Statistik
- Dashboard: gelernte Vokabeln gesamt, fällige Karten heute, Streak
- Fortschrittsbalken pro Lektion und für die Radikale
- Reviews pro Tag der letzten 30 Tage als einfaches Diagramm

## UI/UX
- Mobile-first, deutsche UI
- Cleanes, ruhiges Design, dunkler Modus optional
- Hanzi groß und sauber darstellen (z. B. Noto Sans SC)

## Vorgehen
1. Erst Projektplan mit Ordnerstruktur und Komponenten zeigen
2. Dann Schritt 1 (Datenextraktion) — Schema-Freigabe abwarten, danach vollständig extrahieren und mir die Anzahl der Einträge pro Lektion nennen, damit ich die Vollständigkeit prüfen kann
3. Danach Features in dieser Reihenfolge: Flashcards mit SRS → Quiz-Modi → Radikal-Trainer → Schreibtraining → Statistik
4. Nach jedem Schritt kurz erklären, was gebaut wurde und wie ich es teste (npm run dev)
5. Sauberer, kommentierter Code, damit ich ihn nachvollziehen und erweitern kann

Beginne mit dem Projektplan und frag nach, falls etwas unklar ist.

---

## Tipps

- **Extraktion prüfen:** Lass dir nach Schritt 1 die Einträge z. B. von Lek 2-2 anzeigen und vergleiche mit dem PDF — die PDF-Textextraktion verschluckt manchmal Zeichen oder verrutscht bei Spalten
- **Bedeutungen stichproben:** Die ergänzten Bedeutungen (frühe Lektionen) kurz gegen dein Lehrbuch checken
- **Erweiterungen später einzeln anfragen:** Audio-Aussprache (Web Speech API), Export/Import des Lernstands als JSON, Lektion 7+ wenn der Kurs weitergeht
