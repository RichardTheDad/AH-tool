interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        aria-label={text}
        className="ml-1 inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-[9px] font-bold text-zinc-400 transition hover:border-zinc-400 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-400"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-52 -translate-x-1/2 rounded-xl border border-white/15 bg-zinc-900 px-2.5 py-2 text-left text-[11px] leading-snug text-zinc-300 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
      </span>
    </span>
  );
}
