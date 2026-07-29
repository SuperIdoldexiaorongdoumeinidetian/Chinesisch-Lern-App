// Wörterlisten-Editor: pro Lektion eigene Liste, unabhängig bearbeitbar.
// Sichtbarkeit der Listen nur in der Sitzung (React-State), Änderungen
// werden im App-State (localStorage + optional Cloud-Sync) gespeichert.
import { useMemo, useState } from "react";
import { HSK_LESSONS, RADICAL_DECK } from "../lib/deck";
import {
  addLessonEntry,
  deleteLessonEntry,
  entryKey,
  getLessonEntries,
  isLessonCustomized,
  resetAllLessons,
  resetLesson,
  toggleLessonEntryHidden,
  updateLessonEntry,
  WORD_CLASSES,
} from "../lib/vocab";
import ExamBadge from "./ExamBadge";

const GROUPS = [
  { title: "Lektion 1", items: ["1-1", "1-2", "1-3"] },
  { title: "Lektion 2", items: ["2-1", "2-2", "2-3"] },
  { title: "Lektion 3", items: ["3-1", "3-2", "3-3"] },
  { title: "Lektion 4", items: ["4-1", "4-2", "4-3"] },
  { title: "Lektion 5", items: ["5-1", "5-2", "5-3"] },
  { title: "Lektion 6", items: ["6-1", "6-2", "6-3"] },
  { title: "Extras", items: ["Schriftzeichen", "Kouyu"] },
  { title: "HSK", items: HSK_LESSONS },
];

const inputCls =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800";

function LessonSection({ lesson, customVocab, onCustomVocab, open, onToggle }) {
  const entries = useMemo(
    () => getLessonEntries(lesson, customVocab),
    [lesson, customVocab]
  );
  const customized = isLessonCustomized(customVocab, lesson);
  const hiddenCount = entries.filter((e) => e.hidden).length;

  const patch = (key, field, value) =>
    onCustomVocab(updateLessonEntry(customVocab, lesson, key, { [field]: value }));

  const toggleHidden = (key) =>
    onCustomVocab(toggleLessonEntryHidden(customVocab, lesson, key));

  const remove = (key) => {
    if (!confirm("Eintrag wirklich löschen?")) return;
    onCustomVocab(deleteLessonEntry(customVocab, lesson, key));
  };

  const add = () => {
    onCustomVocab(
      addLessonEntry(customVocab, lesson, {
        hanzi: "",
        pinyin: "",
        meaning: "",
        wordClass: "Substantiv",
        isProperName: false,
      })
    );
  };

  const reset = () => {
    if (!customized) return;
    if (!confirm(`„${lesson}" auf Standard zurücksetzen?`)) return;
    onCustomVocab(resetLesson(customVocab, lesson));
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          onClick={onToggle}
          className="min-w-0 flex-1 text-left text-sm font-medium"
        >
          <span className="font-semibold">{lesson}</span>
          <span className="ml-2 text-zinc-400">
            {entries.length} Einträge
            {hiddenCount > 0 && ` · ${hiddenCount} ausgeblendet`}
            {customized && " · angepasst"}
          </span>
        </button>
        {customized && (
          <button
            onClick={reset}
            className="shrink-0 rounded-full bg-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          >
            Standard
          </button>
        )}
        <button
          onClick={onToggle}
          className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
        >
          {open ? "Ausblenden" : "Anzeigen"}
        </button>
      </div>

      {open && (
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {entries.length === 0 ? (
              <p className="py-2 text-center text-sm text-zinc-500">
                Keine Einträge in dieser Lektion.
              </p>
            ) : (
              entries.map((entry) => {
                const key = entryKey(entry);
                return (
                  <div
                    key={key}
                    className={`space-y-1.5 rounded-lg p-2 ${
                      entry.hidden
                        ? "bg-zinc-50 opacity-60 dark:bg-zinc-900"
                        : "bg-zinc-100 dark:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        value={entry.hanzi}
                        onChange={(e) => patch(key, "hanzi", e.target.value)}
                        placeholder="Hanzi"
                        className={`${inputCls} hanzi text-lg`}
                      />
                      <button
                        onClick={() => toggleHidden(key)}
                        className={`shrink-0 rounded px-2 py-1 text-xs transition-colors ${
                          entry.hidden
                            ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                        }`}
                        title={
                          entry.hidden
                            ? "Beim Lernen wieder einblenden"
                            : "Beim Lernen ausblenden"
                        }
                      >
                        {entry.hidden ? "Einblenden" : "Ausblenden"}
                      </button>
                      <button
                        onClick={() => remove(key)}
                        className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-500 dark:hover:bg-zinc-700"
                        title="Eintrag löschen"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      value={entry.pinyin}
                      onChange={(e) => patch(key, "pinyin", e.target.value)}
                      placeholder="Pinyin"
                      className={inputCls}
                    />
                    <input
                      value={entry.meaning}
                      onChange={(e) => patch(key, "meaning", e.target.value)}
                      placeholder="Bedeutung"
                      className={inputCls}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={entry.wordClass}
                        onChange={(e) => patch(key, "wordClass", e.target.value)}
                        className={inputCls}
                      >
                        {WORD_CLASSES.map((wc) => (
                          <option key={wc} value={wc}>
                            {wc}
                          </option>
                        ))}
                      </select>
                      <ExamBadge card={entry} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button
            onClick={add}
            className="mt-2 w-full rounded-lg border border-dashed border-zinc-300 py-2 text-sm text-zinc-500 hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
          >
            + Eintrag hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}

export default function VocabList({ state, setState }) {
  const { customVocab } = state;
  // Welche Lektionslisten gerade sichtbar sind — nur für diese Sitzung.
  const [openLessons, setOpenLessons] = useState(() => new Set());

  const onCustomVocab = (next) =>
    setState((s) => ({ ...s, customVocab: next }));

  const toggleLesson = (lesson) =>
    setOpenLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lesson)) next.delete(lesson);
      else next.add(lesson);
      return next;
    });

  const customizedCount = useMemo(
    () => GROUPS.flatMap((g) => g.items).filter((l) => isLessonCustomized(customVocab, l)).length,
    [customVocab]
  );

  const resetAll = () => {
    if (customizedCount === 0) return;
    if (!confirm("Alle Wörterlisten auf den Standard zurücksetzen?")) return;
    onCustomVocab(resetAllLessons());
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Jede Lektion hat eine eigene Liste. Änderungen gelten nur für die
          jeweilige Lektion und werden gespeichert. Ausgeblendete Wörter
          erscheinen nicht beim Lernen, Quiz und Schreiben.
          {customizedCount > 0 && (
            <span className="ml-1 text-amber-600 dark:text-amber-400">
              ({customizedCount} angepasst)
            </span>
          )}
        </p>
        <button
          onClick={resetAll}
          disabled={customizedCount === 0}
          className="shrink-0 rounded-full bg-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-300 disabled:opacity-40 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
        >
          Alle auf Standard
        </button>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            {group.title}
          </h3>
          <div className="space-y-2">
            {group.items.map((lesson) => (
              <LessonSection
                key={lesson}
                lesson={lesson}
                customVocab={customVocab}
                onCustomVocab={onCustomVocab}
                open={openLessons.has(lesson)}
                onToggle={() => toggleLesson(lesson)}
              />
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-zinc-400">
        Radikale ({RADICAL_DECK}) sind hier nicht enthalten — sie liegen in einer
        separaten Datei und lassen sich nicht bearbeiten.
      </p>
    </div>
  );
}
