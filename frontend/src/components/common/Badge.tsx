import type { PropsWithChildren } from "react";

const badgeStyles = {
  neutral: "bg-white/5 text-zinc-200 border-white/10",
  success: "bg-emerald-500/10 text-emerald-300 border-emerald-400/25",
  warning: "bg-amber-500/10 text-amber-300 border-amber-400/25",
  danger: "bg-rose-500/10 text-rose-300 border-rose-400/25",
};

interface BadgeProps {
  tone?: keyof typeof badgeStyles;
}

export function Badge({ tone = "neutral", children }: PropsWithChildren<BadgeProps>) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeStyles[tone]}`}>
      {children}
    </span>
  );
}

