import { type PropsWithChildren } from "react";

type StatusType = "success" | "warning" | "danger" | "info" | "muted";

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "badge" | "pill" | "dot" | "inline";
}

const statusStyles: Record<StatusType, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  warning: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  danger: {
    bg: "bg-rose-100",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  info: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
  },
  muted: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

const sizeMap = {
  sm: { badge: "px-2 py-1 text-xs", dot: "h-1.5 w-1.5", pill: "px-2 py-0.5 text-xs" },
  md: { badge: "px-2.5 py-1 text-sm", dot: "h-2 w-2", pill: "px-2.5 py-1 text-xs" },
  lg: { badge: "px-3 py-1.5 text-sm", dot: "h-2.5 w-2.5", pill: "px-3 py-1 text-sm" },
};

export function StatusIndicator({
  status,
  label,
  size = "md",
  variant = "badge",
  children,
}: PropsWithChildren<StatusIndicatorProps>) {
  const style = statusStyles[status];
  const sizes = sizeMap[size];

  switch (variant) {
    case "badge":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${sizes.badge} ${style.bg} ${style.text} ${style.border}`}
        >
          {label || children}
        </span>
      );

    case "pill":
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizes.pill} ${style.bg} ${style.text}`}>
          <span className={`${style.dot} rounded-full ${sizes.dot}`} />
          {label || children}
        </span>
      );

    case "dot":
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`${style.dot} rounded-full ${sizes.dot}`} />
          {label && <span className="text-sm text-slate-700">{label}</span>}
        </span>
      );

    case "inline":
      return (
        <span className={`inline ${style.text} font-medium`}>
          {label || children}
        </span>
      );

    default:
      return null;
  }
}
