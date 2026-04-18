import type { ScanResult, ScannerFilters } from "../types/models";
import { isBattlePetCategory, isBattlePetResult } from "./itemCategories";

export const TRACKED_REALMS_FILTER_VALUE = "__tracked_realms__";
export const ALL_REALMS_FILTER_VALUE = "__all_realms__";

function toSortValue(result: ScanResult, sortBy: ScannerFilters["sortBy"]) {
  return Number(result[sortBy] ?? 0);
}

function normalizeRealmFilter(value: string) {
  return value || TRACKED_REALMS_FILTER_VALUE;
}

function normalizeRealmKey(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\s+/g, " ");
}

function matchesRealmScope(value: string | null | undefined, filterValue: string, trackedRealms: Set<string>) {
  const normalizedFilter = normalizeRealmFilter(filterValue);
  const normalizedValue = normalizeRealmKey(value);

  if (normalizedFilter === ALL_REALMS_FILTER_VALUE) {
    return true;
  }
  if (normalizedFilter === TRACKED_REALMS_FILTER_VALUE) {
    return trackedRealms.size === 0 || trackedRealms.has(normalizedValue);
  }

  return normalizedValue === normalizeRealmKey(normalizedFilter);
}

function matchesFilters(result: ScanResult, filters: ScannerFilters, trackedRealms: Set<string>) {
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
  if (!matchesRealmScope(result.cheapest_buy_realm, filters.buyRealm, trackedRealms)) return false;
  if (!matchesRealmScope(result.best_sell_realm, filters.sellRealm, trackedRealms)) return false;

  return true;
}

function matchesTrackedEitherSide(result: ScanResult, trackedRealms: Set<string>) {
  if (trackedRealms.size === 0) {
    return true;
  }
  const buyRealm = normalizeRealmKey(result.cheapest_buy_realm);
  const sellRealm = normalizeRealmKey(result.best_sell_realm);
  return trackedRealms.has(buyRealm) || trackedRealms.has(sellRealm);
}

export function filterScanResults(results: ScanResult[], filters: ScannerFilters, options?: { trackedRealms?: string[] }) {
  const trackedRealms = new Set((options?.trackedRealms ?? []).map((realm) => normalizeRealmKey(realm)).filter(Boolean));
  const filtered = results.filter((result) => matchesFilters(result, filters, trackedRealms));

  const strictTrackedBothSides =
    filtered.length === 0 &&
    filters.buyRealm === TRACKED_REALMS_FILTER_VALUE &&
    filters.sellRealm === TRACKED_REALMS_FILTER_VALUE;

  const mixedTrackedAndAllRealms =
    filtered.length === 0 &&
    ((filters.buyRealm === TRACKED_REALMS_FILTER_VALUE && filters.sellRealm === ALL_REALMS_FILTER_VALUE) ||
      (filters.buyRealm === ALL_REALMS_FILTER_VALUE && filters.sellRealm === TRACKED_REALMS_FILTER_VALUE));

  const shouldFallbackToEitherTrackedSide = strictTrackedBothSides || mixedTrackedAndAllRealms;

  const effectiveResults = shouldFallbackToEitherTrackedSide
    ? results.filter((result) => matchesTrackedEitherSide(result, trackedRealms))
    : filtered;

  return effectiveResults.sort((a, b) => {
    const difference = toSortValue(b, filters.sortBy) - toSortValue(a, filters.sortBy);
    if (difference !== 0) {
      return filters.sortDirection === "asc" ? -difference : difference;
    }

    return a.item_name.localeCompare(b.item_name);
  });
}
