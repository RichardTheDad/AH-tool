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
    default: "border-white/70 bg-white/85 backdrop-blur-sm shadow-card",
    elevated: "border-white/80 bg-white/95 backdrop-blur-md shadow-lg",
    flat: "border border-slate-200 bg-white shadow-sm",
  };

  const paddingClass = noPadding ? "" : "p-5";

  return (
    <section className={`panel-glow rounded-2xl ${className}`} {...props}>
      <div className={`rounded-2xl border ${variantClasses[variant]} ${paddingClass}`}>
        {(title || subtitle) && (
          <header className={noPadding ? "p-5 pb-0" : "mb-4"}>
            {title ? <h2 className="font-display text-lg font-semibold text-ink">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

