interface ErrorStateProps {
  title?: string;
  message: string;
  action?: React.ReactNode;
}

export function ErrorState({ title = "Something went wrong", message, action }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
      <h3 className="font-semibold text-rose-700">{title}</h3>
      <p className="mt-1 text-sm text-rose-600">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

