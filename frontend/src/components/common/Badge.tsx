import type { PropsWithChildren } from "react";

const badgeStyles = {
  neutral: "bg-white/10 text-zinc-200 border-white/20",
  success: "bg-emerald-500/20 text-emerald-300 border-emerald-400/35",
  warning: "bg-amber-500/20 text-amber-300 border-amber-400/35",
  danger: "bg-rose-500/20 text-rose-300 border-rose-400/35",
};

interface BadgeProps {
  tone?: keyof typeof badgeStyles;
}

export function Badge({ tone = "neutral", children }: PropsWithChildren<BadgeProps>) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeStyles[tone]}`}>
      {children}
    </span>
  );
}

