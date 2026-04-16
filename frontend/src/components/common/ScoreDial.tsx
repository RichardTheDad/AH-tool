type ScoreDialProps = {
  score: number;
  title?: string;
  className?: string;
};

function toneColor(score: number): string {
  if (score >= 70) return "#34d399";
  if (score >= 50) return "#fb923c";
  return "#f87171";
}

export function ScoreDial({ score, title, className = "" }: ScoreDialProps) {
  const color = toneColor(score);

  return (
    <span
      title={title}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold ${className}`.trim()}
      style={{ color, borderColor: color }}
    >
      {Math.round(score)}
    </span>
  );
}