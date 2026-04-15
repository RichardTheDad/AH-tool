interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-zinc-900/60 p-8 text-center">
      {icon && <div className="mb-4 flex justify-center text-zinc-500 text-3xl">{icon}</div>}
      <h3 className="font-display text-base font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400 max-w-xs mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

