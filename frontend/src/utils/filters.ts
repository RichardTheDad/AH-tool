import type { ScanResult, ScannerFilters } from "../types/models";
import { isBattlePetCategory, isBattlePetResult } from "./itemCategories";

function toSortValue(result: ScanResult, sortBy: ScannerFilters["sortBy"]) {
  return Number(result[sortBy] ?? 0);
}

function matchesFilters(result: ScanResult, filters: ScannerFilters) {
  const minProfit = Number(filters.minProfit || 0);
  const minRoi = Number(filters.minRoi || 0);
  const minSpread = Number(filters.minSpread || 0);
  const maxSpread = Number(filters.maxSpread || 0);
  const maxBuyPrice = Number(filters.maxBuyPrice || 0);
  const minConfidence = Number(filters.minConfidence || 0);

  if (minProfit && result.estimated_profit < minProfit) return false;
  if (minRoi && result.roi < minRoi) return false;
  if (minSpread && Number(result.spread_percent ?? 0) < minSpread) return false;
  if (maxSpread && Number(result.spread_percent ?? 0) > maxSpread) return false;
  if (maxBuyPrice && result.cheapest_buy_price > maxBuyPrice) return false;
  if (minConfidence && result.confidence_score < minConfidence) return false;
  if (filters.hideRisky && result.is_risky) return false;
  if (filters.category) {
    const selectedCategory = filters.category.toLowerCase();
    const resultCategory = result.item_class_name?.toLowerCase() ?? "";
    const matchesBattlePetCategory = isBattlePetCategory(filters.category) && isBattlePetResult(result);
    if (!matchesBattlePetCategory && resultCategory !== selectedCategory) return false;
  }
  if (filters.subcategory && result.item_subclass_name?.toLowerCase() !== filters.subcategory.toLowerCase()) return false;
  if (filters.buyRealm && result.cheapest_buy_realm?.toLowerCase() !== filters.buyRealm.toLowerCase()) return false;
  if (filters.sellRealm && result.best_sell_realm?.toLowerCase() !== filters.sellRealm.toLowerCase()) return false;

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
