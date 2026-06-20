#!/usr/bin/env python3
"""Erkennt farbliche Markierungen im Vokabel-PDF und ordnet sie den
vocab.json-Eintraegen zu.

Befund (siehe Analyse):
- Es gibt KEINE Annotationen (page.annots() ist leer).
- Markierungen liegen als gefuellte Rechtecke (page.get_drawings) hinter dem
  Text. Vorkommende Fuellfarben:
    gelb  #FFFF00  -> echte Vokabel-Markierung
    grau  #C0C0C0  -> echte Vokabel-Markierung (z. B. 没（有）, 的)
    gruen #008000  -> NUR Hintergrund der Spalten-Header "Lek x-2" (Design)
    cyan  #00FFFF  -> NUR Hintergrund der Spalten-Header "Lek x-3" (Design)
    schwarz         -> nur duenne Trennlinien (Hoehe ~0.7)
  => Als Highlight zaehlen ausschliesslich gelb und grau.

Zuordnung: Hanzi-Spans (get_text('dict')) werden zeilenweise gruppiert, damit
in Spans zerlegte Eintraege wie 没 + （有） wieder zu "没有" werden. Eine Zeile
gilt als markiert, wenn die summierte Ueberlappung ihrer Span-Flaeche mit den
Highlight-Rechtecken einer Farbe den Schwellenwert ueberschreitet.
"""
import fitz, json, re, sys
from collections import defaultdict, Counter

PDF = "Vokabeln Zeichen Lek 1-6 汉字  +.pdf"
VOCAB = "src/data/vocab.json"
THRESH = 0.30  # Mindestanteil der Span-Flaeche, der ueberdeckt sein muss

# Nur diese Farben sind echte Markierungen.
HIGHLIGHT_COLORS = {
    (1.0, 1.0, 0.0):     "#FFFF00",  # gelb
    (0.753,0.753,0.753): "#C0C0C0",  # grau
}

CJK = re.compile(r'[一-鿿㐀-䶿]')
def cjk_only(t): return ''.join(ch for ch in t if CJK.match(ch))

def lesson_for(page_no, x_center):
    """Seiten 0-5: 3 Spalten = 3 Lektionen. Seite 6: Schriftzeichen. 7-8: Kouyu."""
    if page_no <= 5:
        col = 1 if x_center < 230 else (2 if x_center < 378 else 3)
        return f"{page_no + 1}-{col}"
    if page_no == 6:
        return "Schriftzeichen"
    return "Kouyu"

def overlap(a, b):
    r = a & b
    return r.get_area() if not r.is_empty else 0.0

def lesson_sort(k):
    m = re.match(r'(\d+)-(\d+)', k)
    return (0, int(m.group(1)), int(m.group(2))) if m else (1, 0, 0)

# ---------------------------------------------------------------- PDF einlesen
doc = fitz.open(PDF)
rows = []  # je Eintrag im PDF: {lesson, hanzi, highlighted, color, multi_color}

for pno, page in enumerate(doc):
    # Highlight-Rechtecke je Farbe (duenne Linien raus)
    hl = defaultdict(list)
    for d in page.get_drawings():
        f = d.get("fill")
        if f is None:
            continue
        key = tuple(round(x, 3) for x in f)
        hexc = HIGHLIGHT_COLORS.get(key)
        if not hexc:
            continue
        r = fitz.Rect(d["rect"])
        if r.height >= 5:
            hl[hexc].append(r)

    # Hanzi-Spans sammeln und nach Zeile (y) gruppieren. Achtung: jede
    # "Lek"-Spalte enthaelt ZWEI Wort-Spalten -> Woerter derselben Zeile nur
    # zusammenfassen, wenn sie in x direkt benachbart sind (Luecke < GAP).
    GAP = 8
    line_spans = defaultdict(list)
    for b in page.get_text("dict")["blocks"]:
        for line in b.get("lines", []):
            for s in line["spans"]:
                han = cjk_only(s["text"])
                if not han:
                    continue
                sb = fitz.Rect(s["bbox"])
                if sb.get_area() <= 0:
                    continue
                line_spans[round(sb.y0)].append((sb.x0, han, sb))

    words = []  # (hanzi, [boxes])
    for y, parts in line_spans.items():
        parts.sort(key=lambda t: t[0])
        cur_h, cur_b, prev_x1 = "", [], None
        for x0, han, sb in parts:
            if prev_x1 is not None and x0 - prev_x1 > GAP:
                words.append((cur_h, cur_b)); cur_h, cur_b = "", []
            cur_h += han; cur_b.append(sb); prev_x1 = sb.x1
        if cur_b:
            words.append((cur_h, cur_b))

    for hanzi, boxes in words:
        total_area = sum(bx.get_area() for bx in boxes)
        # je Farbe summierte Ueberlappung ueber alle Spans der Zeile
        per_color = {}
        for hexc, rects in hl.items():
            ov = sum(overlap(bx, r) for bx in boxes for r in rects)
            per_color[hexc] = ov
        hits = [c for c, ov in per_color.items() if ov / total_area >= THRESH]
        best = max(per_color, key=per_color.get) if per_color else None
        highlighted = bool(best and per_color[best] / total_area >= THRESH)
        rows.append({
            "lesson": lesson_for(pno, boxes[0].x0 + 1),
            "hanzi": hanzi,
            "highlighted": highlighted,
            "color": best if highlighted else None,
            "multi_color": len(hits) > 1,
        })

# ------------------------------------------------------------ Matching/Migration
vocab = json.load(open(VOCAB, encoding="utf-8"))

idx = defaultdict(list)            # (lesson, hanzi) -> rows
idx_h = defaultdict(list)          # hanzi -> rows (Fallback)
for r in rows:
    idx[(r["lesson"], r["hanzi"])].append(r)
    idx_h[r["hanzi"]].append(r)

used = set()
per_lesson_hl = Counter()
per_lesson_total = Counter()
color_counter = Counter()
unmatched, ambiguous, fallback = [], [], []

def take(cands):
    for r in cands:
        if id(r) not in used:
            return r
    return None

def take_prefix(lesson, h):
    """Letzter Ausweg fuer ……-Konstruktionen (z. B. 一边……一边……): das PDF
    zerlegt sie in Fragmente. Suche eine PDF-Zeile derselben Lektion, deren
    Hanzi ein Praefix des Eintrags ist (laengste zuerst)."""
    cands = [r for r in rows
             if r["lesson"] == lesson and id(r) not in used and r["hanzi"]
             and h.startswith(r["hanzi"])]
    cands.sort(key=lambda r: len(r["hanzi"]), reverse=True)
    return cands[0] if cands else None

for e in vocab:
    h = cjk_only(e["hanzi"])
    per_lesson_total[e["lesson"]] += 1
    r = take(idx.get((e["lesson"], h), [])) or take(idx_h.get(h, []))
    if r is None and h:
        r = take_prefix(e["lesson"], h)
        if r is not None:
            fallback.append((e["lesson"], e["hanzi"], r["hanzi"], r["color"]))
    if r is None:
        e["highlighted"] = False
        e.pop("highlightColor", None)
        if h:
            unmatched.append((e["lesson"], e["hanzi"]))
        continue
    used.add(id(r))
    e["highlighted"] = r["highlighted"]
    if r["highlighted"]:
        e["highlightColor"] = r["color"]
        per_lesson_hl[e["lesson"]] += 1
        color_counter[r["color"]] += 1
        if r["multi_color"]:
            ambiguous.append((e["lesson"], e["hanzi"], r["color"]))
    else:
        e.pop("highlightColor", None)

# ----------------------------------------------------------------------- Report
print("Highlight-Form im PDF: ausschliesslich farbige Fuellflaechen, keine Annotationen.")
print("Als Markierung gewertet: gelb (#FFFF00) und grau (#C0C0C0).")
print("Ausgeschlossen: gruen/cyan (Spalten-Header-Design), schwarz (Trennlinien).\n")
print(f"PDF-Zeilen erkannt: {len(rows)}  |  vocab-Eintraege: {len(vocab)}")
print(f"Markiert gesamt: {sum(per_lesson_hl.values())}  |  Farben: {dict(color_counter)}")
print(f"Nicht im PDF zugeordnet: {len(unmatched)}\n")

print("Markierte Eintraege pro Lektion:")
for les in sorted(per_lesson_total, key=lesson_sort):
    if per_lesson_hl[les]:
        print(f"  {les:14s} {per_lesson_hl[les]:3d} / {per_lesson_total[les]}")

print("\nBeispiel-Lektion 6-1 (markierte Hanzi zur PDF-Kontrolle):")
for e in vocab:
    if e["lesson"] == "6-1" and e.get("highlighted"):
        print(f"  {e['hanzi']:6s} {e['pinyin']:12s} [{e.get('highlightColor')}]")

if fallback:
    print("\nUeber Praefix-Fallback zugeordnet (……-Konstruktionen, bitte pruefen):")
    for f in fallback:
        print(f"   {f[0]} {f[1]}  <- PDF-Fragment {f[2]} [{f[3]}]")
if ambiguous:
    print("\nUNSICHER (Zeile ueberlappt mehrere Farben - bitte pruefen):")
    for a in ambiguous:
        print("  ", a)
if unmatched:
    print("\nHanzi nicht im PDF gefunden (highlighted=False gesetzt):")
    for u in unmatched:
        print("  ", u)

if "--write" in sys.argv:
    json.dump(vocab, open(VOCAB, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print("\n>>> vocab.json geschrieben.")
else:
    print("\n(Probelauf - nichts geschrieben. Mit --write speichern.)")
