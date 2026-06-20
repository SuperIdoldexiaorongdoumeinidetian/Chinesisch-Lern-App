// Kleiner Hinweis, dass eine Vokabel im Originaldokument farbig markiert war.
// Gelb (#FFFF00) bedeutet "prüfungsrelevant"; andere Farben (z. B. Silber)
// werden neutral als "markiert" angezeigt. Bei nicht markierten Karten und
// Radikalen wird nichts gerendert.
export default function ExamBadge({ card, className = "" }) {
  if (!card?.highlighted) return null;
  const exam = card.highlightColor === "#FFFF00";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        exam
          ? "bg-amber-200 text-amber-900 dark:bg-amber-400/20 dark:text-amber-300"
          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
      } ${className}`}
      title={
        exam
          ? "Im Original gelb markiert — prüfungsrelevant"
          : "Im Original markiert"
      }
    >
      ★ {exam ? "prüfungsrelevant" : "markiert"}
    </span>
  );
}
