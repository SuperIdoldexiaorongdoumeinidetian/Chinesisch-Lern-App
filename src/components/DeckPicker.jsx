// Auswahl der Lern-Decks (Lektionen + Radikale), der Kartenrichtungen
// und des Eigennamen-Schalters. Wird von Flashcards und Quiz genutzt.
import { RADICAL_DECK, HSK_LESSONS, DIRECTIONS } from "../lib/deck";

const GROUPS = [
  { title: "Lektion 1", items: ["1-1", "1-2", "1-3"] },
  { title: "Lektion 2", items: ["2-1", "2-2", "2-3"] },
  { title: "Lektion 3", items: ["3-1", "3-2", "3-3"] },
  { title: "Lektion 4", items: ["4-1", "4-2", "4-3"] },
  { title: "Lektion 5", items: ["5-1", "5-2", "5-3"] },
  { title: "Lektion 6", items: ["6-1", "6-2", "6-3"] },
  { title: "Extras", items: ["Schriftzeichen", "Kouyu", RADICAL_DECK] },
  { title: "HSK", items: HSK_LESSONS },
];

export default function DeckPicker({
  decks,
  onDecks,
  directions,
  onDirections,
  includeProperNames,
  onIncludeProperNames,
  onlyHighlighted,
  onOnlyHighlighted,
  showDirections = true,
}) {
  const toggleDeck = (d) =>
    onDecks(decks.includes(d) ? decks.filter((x) => x !== d) : [...decks, d]);

  const toggleGroup = (items) => {
    const allOn = items.every((d) => decks.includes(d));
    onDecks(
      allOn
        ? decks.filter((d) => !items.includes(d))
        : [...new Set([...decks, ...items])]
    );
  };

  const toggleDir = (d) => {
    const next = directions.includes(d)
      ? directions.filter((x) => x !== d)
      : [...directions, d];
    if (next.length > 0) onDirections(next); // mindestens eine Richtung behalten
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Decks auswählen
        </h3>
        <div className="space-y-2">
          {GROUPS.map((g) => (
            <div key={g.title} className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => toggleGroup(g.items)}
                className="w-24 shrink-0 text-left text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                title="Ganze Gruppe an/aus"
              >
                {g.title}
              </button>
              {g.items.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDeck(d)}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    decks.includes(d)
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {showDirections && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Kartenrichtung
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(DIRECTIONS).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => toggleDir(key)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  directions.includes(key)
                    ? "bg-sky-600 text-white"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={includeProperNames}
          onChange={(e) => onIncludeProperNames(e.target.checked)}
          className="h-4 w-4 accent-emerald-600"
        />
        Eigennamen (Personennamen) einbeziehen
      </label>

      {/* Filter: nur die im Original gelb markierten = prüfungsrelevanten Vokabeln.
          Radikale entfallen dann automatisch. */}
      {onOnlyHighlighted && (
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={onlyHighlighted}
            onChange={(e) => onOnlyHighlighted(e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          Nur prüfungsrelevante (★ gelb markierte) Vokabeln
        </label>
      )}
    </div>
  );
}
