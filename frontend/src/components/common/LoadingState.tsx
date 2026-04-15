export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-zinc-900/60 p-8 text-center">
      <div className="inline-block mb-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
      </div>
      <p className="text-sm text-zinc-300">{label}</p>
    </div>
  );
}

