export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <div className="rounded-2xl border border-dashed border-brass/40 bg-white/60 p-6 text-sm text-slate-600">{label}</div>;
}

