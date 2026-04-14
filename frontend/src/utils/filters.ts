import type { ScanResult, ScannerFilters } from "../types/models";

function toSortValue(result: ScanResult, sortBy: ScannerFilters["sortBy"]) {
  return Number(result[sortBy] ?? 0);
}

function preferenceScore(result: ScanResult, filters: ScannerFilters) {
  let score = 0;
  const minProfit = Number(filters.minProfit || 0);
  const minRoi = Number(filters.minRoi || 0);
  const maxBuyPrice = Number(filters.maxBuyPrice || 0);
  const minConfidence = Number(filters.minConfidence || 0);

  if (!minProfit || result.estimated_profit >= minProfit) score += 2;
  if (!minRoi || result.roi >= minRoi) score += 2;
  if (!maxBuyPrice || result.cheapest_buy_price <= maxBuyPrice) score += 2;
  if (!minConfidence || result.confidence_score >= minConfidence) score += 2;
  if (!filters.allowStale && !result.has_stale_data) score += 1;
  if (filters.hideRisky && !result.is_risky) score += 1;
  if (filters.category && result.item_class_name?.toLowerCase() === filters.category.toLowerCase()) score += 3;

  return score;
}

export function filterScanResults(results: ScanResult[], filters: ScannerFilters) {
  return [...results].sort((a, b) => {
    const preferenceDifference = preferenceScore(b, filters) - preferenceScore(a, filters);
    if (preferenceDifference !== 0) {
      return preferenceDifference;
    }

    const difference = toSortValue(b, filters.sortBy) - toSortValue(a, filters.sortBy);
    if (difference !== 0) {
      return filters.sortDirection === "asc" ? -difference : difference;
    }

    return a.item_name.localeCompare(b.item_name);
  });
}
