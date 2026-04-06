import type { PropsWithChildren } from "react";

const badgeStyles = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-rose-100 text-rose-700 border-rose-200",
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

