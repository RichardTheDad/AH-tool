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
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-400/35",
    dot: "bg-emerald-400",
  },
  warning: {
    bg: "bg-amber-500/20",
    text: "text-amber-300",
    border: "border-amber-400/35",
    dot: "bg-amber-400",
  },
  danger: {
    bg: "bg-rose-500/20",
    text: "text-rose-300",
    border: "border-rose-400/35",
    dot: "bg-rose-400",
  },
  info: {
    bg: "bg-sky-500/20",
    text: "text-sky-300",
    border: "border-sky-400/35",
    dot: "bg-sky-400",
  },
  muted: {
    bg: "bg-white/10",
    text: "text-zinc-300",
    border: "border-white/15",
    dot: "bg-zinc-400",
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
          {label && <span className="text-sm text-zinc-300">{label}</span>}
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
