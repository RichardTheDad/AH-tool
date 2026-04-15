import type { ScanResult, ScannerFilters } from "../types/models";

function toSortValue(result: ScanResult, sortBy: ScannerFilters["sortBy"]) {
  return Number(result[sortBy] ?? 0);
}

function matchesFilters(result: ScanResult, filters: ScannerFilters) {
  const minProfit = Number(filters.minProfit || 0);
  const minRoi = Number(filters.minRoi || 0);
  const maxBuyPrice = Number(filters.maxBuyPrice || 0);
  const minConfidence = Number(filters.minConfidence || 0);

  if (minProfit && result.estimated_profit < minProfit) return false;
  if (minRoi && result.roi < minRoi) return false;
  if (maxBuyPrice && result.cheapest_buy_price > maxBuyPrice) return false;
  if (minConfidence && result.confidence_score < minConfidence) return false;
  if (filters.hideRisky && result.is_risky) return false;
  if (filters.category && result.item_class_name?.toLowerCase() !== filters.category.toLowerCase()) return false;

  return true;
}

export function filterScanResults(results: ScanResult[], filters: ScannerFilters) {
  return results.filter((result) => matchesFilters(result, filters)).sort((a, b) => {
    const difference = toSortValue(b, filters.sortBy) - toSortValue(a, filters.sortBy);
    if (difference !== 0) {
      return filters.sortDirection === "asc" ? -difference : difference;
    }

    return a.item_name.localeCompare(b.item_name);
  });
}
