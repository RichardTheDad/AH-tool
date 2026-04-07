export function formatGold(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";

  const sign = value < 0 ? "-" : "";
  const totalCopper = Math.round(Math.abs(value));
  const gold = Math.floor(totalCopper / 10000);
  const silver = Math.floor((totalCopper % 10000) / 100);
  const copper = totalCopper % 100;

  return `${sign}${gold.toLocaleString("en-US")}g ${silver}s ${copper}c`;
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(0)}/100`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
