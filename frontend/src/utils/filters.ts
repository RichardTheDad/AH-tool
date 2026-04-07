import type { ScanResult, ScannerFilters } from "../types/models";

export function filterScanResults(results: ScanResult[], filters: ScannerFilters) {
  const minProfit = Number(filters.minProfit || 0);
  const minRoi = Number(filters.minRoi || 0);
  const maxBuyPrice = Number(filters.maxBuyPrice || 0);
  const minConfidence = Number(filters.minConfidence || 0);

  const filtered = results.filter((result) => {
    if (result.estimated_profit < minProfit) return false;
    if (result.roi < minRoi) return false;
    if (maxBuyPrice > 0 && result.cheapest_buy_price > maxBuyPrice) return false;
    if (result.confidence_score < minConfidence) return false;
    if (!filters.allowStale && result.has_stale_data) return false;
    if (filters.hideRisky && result.is_risky) return false;
    if (filters.category && result.item_class_name?.toLowerCase() !== filters.category.toLowerCase()) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    const left = a[filters.sortBy];
    const right = b[filters.sortBy];
    const difference = Number(right) - Number(left);
    return filters.sortDirection === "asc" ? -difference : difference;
  });
}
