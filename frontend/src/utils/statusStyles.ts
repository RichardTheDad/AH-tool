export function readinessTextColor(status: string): string {
  if (status === "blocked") return "text-rose-700";
  if (status === "caution") return "text-amber-700";
  return "text-emerald-700";
}

export function realmFreshnessBadge(hasData: boolean, freshItemCount: number): string {
  if (!hasData) return "bg-rose-100 text-rose-700";
  if (freshItemCount > 0) return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
}
