import type { HTMLAttributes, PropsWithChildren } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
}

export function Card({ title, subtitle, children, className = "", ...props }: PropsWithChildren<CardProps>) {
  return (
    <section className={`panel-glow rounded-3xl ${className}`} {...props}>
      <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur-sm">
        {(title || subtitle) && (
          <header className="mb-4">
            {title ? <h2 className="font-display text-lg font-semibold text-ink">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

