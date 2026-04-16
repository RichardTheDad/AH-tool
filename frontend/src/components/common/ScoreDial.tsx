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
  const normalizedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const color = toneColor(normalizedScore);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalizedScore / 100);

  return (
    <span
      title={title}
      className={`relative inline-flex h-11 w-11 items-center justify-center text-sm font-bold ${className}`.trim()}
      style={{ color }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 44 44"
        className="absolute inset-0 h-11 w-11 -rotate-90"
      >
        <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(113, 113, 122, 0.45)" strokeWidth="2" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="relative z-[1]">{Math.round(normalizedScore)}</span>
    </span>
  );
}