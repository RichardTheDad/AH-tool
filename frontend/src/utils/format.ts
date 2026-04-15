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

export function formatMarketPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  const percent = value * 100;
  if (percent === 0) return "0.0%";
  if (percent < 0.001) return "<0.001%";
  if (percent < 0.1) return `${percent.toFixed(3)}%`;
  return `${percent.toFixed(1)}%`;
}

export function formatMarketPerDay(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  if (value === 0) return "0.000";
  if (value < 0.001) return "<0.001";
  return value.toFixed(3);
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

/** Compact gold label for chart Y-axes — drops copper, abbreviates to just gold for large values. */
export function formatGoldChartLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  const sign = value < 0 ? "-" : "";
  const totalCopper = Math.round(Math.abs(value));
  const gold = Math.floor(totalCopper / 10000);
  const silver = Math.floor((totalCopper % 10000) / 100);
  if (gold >= 1000) return `${sign}${gold.toLocaleString("en-US")}g`;
  if (gold > 0) return silver > 0 ? `${sign}${gold.toLocaleString("en-US")}g ${silver}s` : `${sign}${gold.toLocaleString("en-US")}g`;
  return `${sign}${silver}s`;
}

/** Splits a copper value into parts for icon-based currency rendering. */
export function formatGoldParts(value: number | null | undefined): { sign: string; gold: number; silver: number; copper: number } | null {
  if (value === null || value === undefined) return null;
  const sign = value < 0 ? "-" : "";
  const totalCopper = Math.round(Math.abs(value));
  const gold = Math.floor(totalCopper / 10000);
  const silver = Math.floor((totalCopper % 10000) / 100);
  const copper = totalCopper % 100;
  return { sign, gold, silver, copper };
}
