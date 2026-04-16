import type { HTMLAttributes, PropsWithChildren } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  noPadding?: boolean;
  variant?: "default" | "elevated" | "flat";
}

export function Card({
  title,
  subtitle,
  noPadding = false,
  variant = "default",
  children,
  className = "",
  ...props
}: PropsWithChildren<CardProps>) {
  const variantClasses = {
    default: "border-white/10 bg-white/3 backdrop-blur-sm shadow-card",
    elevated: "border-white/15 bg-white/5 backdrop-blur-xl shadow-lg",
    flat: "border-white/10 bg-zinc-900/35 shadow-sm",
  };

  const paddingClass = noPadding ? "" : "p-5";

  return (
    <section className={`panel-glow rounded-2xl border ${variantClasses[variant]} ${paddingClass} ${className}`} {...props}>
      {(title || subtitle) && (
        <header className={noPadding ? "p-5 pb-0" : "mb-4"}>
          {title ? <h2 className="font-display text-lg font-semibold text-zinc-100">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}

