import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { ScannerFilters } from "../types/models";

const SCANNER_FILTERS_STORAGE_KEY = "scanner.filters.v1";
const ALLOWED_SORT_BY: ScannerFilters["sortBy"][] = [
  "final_score",
  "estimated_profit",
  "cheapest_buy_price",
  "roi",
  "spread_percent",
  "confidence_score",
  "sellability_score",
];
const ALLOWED_SORT_DIRECTION: ScannerFilters["sortDirection"][] = ["asc", "desc"];

function parseStoredFilters(raw: string | null): Partial<ScannerFilters> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ScannerFilters>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizeText(value: unknown, maxLength = 64): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function sanitizeNumericString(value: unknown, options: { min: number; max: number }): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < options.min || parsed > options.max) {
    return "";
  }
  return normalized;
}

function sanitizeSortBy(value: string | null): ScannerFilters["sortBy"] {
  if (!value) {
    return "final_score";
  }
  return ALLOWED_SORT_BY.includes(value as ScannerFilters["sortBy"]) ? (value as ScannerFilters["sortBy"]) : "final_score";
}

function sanitizeSortDirection(value: string | null): ScannerFilters["sortDirection"] {
  if (!value) {
    return "desc";
  }
  return ALLOWED_SORT_DIRECTION.includes(value as ScannerFilters["sortDirection"])
    ? (value as ScannerFilters["sortDirection"])
    : "desc";
}

function sanitizePartialFilters(input: Partial<ScannerFilters> | null | undefined): Partial<ScannerFilters> {
  if (!input) {
    return {};
  }
  return {
    minProfit: sanitizeNumericString(input.minProfit, { min: 0, max: 1000000000 }),
    minRoi: sanitizeNumericString(input.minRoi, { min: 0, max: 1000 }),
    minSpread: sanitizeNumericString(input.minSpread, { min: -100, max: 1000 }),
    maxSpread: sanitizeNumericString(input.maxSpread, { min: -100, max: 1000 }),
    maxBuyPrice: sanitizeNumericString(input.maxBuyPrice, { min: 0, max: 1000000000 }),
    minConfidence: sanitizeNumericString(input.minConfidence, { min: 0, max: 100 }),
    category: sanitizeText(input.category),
    buyRealm: sanitizeText(input.buyRealm),
    sellRealm: sanitizeText(input.sellRealm),
    hideRisky: Boolean(input.hideRisky),
    sortBy: sanitizeSortBy(input.sortBy ?? null),
    sortDirection: sanitizeSortDirection(input.sortDirection ?? null),
  };
}

function toBoolean(value: string | null, defaultValue = false): boolean {
  if (value === null) {
    return defaultValue;
  }
  return value === "true" || value === "1";
}

export function useScannerFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: ScannerFilters = {
    minProfit: sanitizeNumericString(searchParams.get("minProfit"), { min: 0, max: 1000000000 }),
    minRoi: sanitizeNumericString(searchParams.get("minRoi"), { min: 0, max: 1000 }),
    minSpread: sanitizeNumericString(searchParams.get("minSpread"), { min: -100, max: 1000 }),
    maxSpread: sanitizeNumericString(searchParams.get("maxSpread"), { min: -100, max: 1000 }),
    maxBuyPrice: sanitizeNumericString(searchParams.get("maxBuyPrice"), { min: 0, max: 1000000000 }),
    minConfidence: sanitizeNumericString(searchParams.get("minConfidence"), { min: 0, max: 100 }),
    category: sanitizeText(searchParams.get("category")),
    buyRealm: sanitizeText(searchParams.get("buyRealm")),
    sellRealm: sanitizeText(searchParams.get("sellRealm")),
    hideRisky: toBoolean(searchParams.get("hideRisky"), false),
    sortBy: sanitizeSortBy(searchParams.get("sortBy")),
    sortDirection: sanitizeSortDirection(searchParams.get("sortDirection")),
  };

  const updateFilters = useCallback((next: Partial<ScannerFilters>) => {
    const merged = sanitizePartialFilters({ ...filters, ...next });
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value === "" || value === false || value === undefined || value === null) {
        return;
      }
      params.set(key, String(value));
    });
    setSearchParams(params, { replace: true });

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SCANNER_FILTERS_STORAGE_KEY, JSON.stringify(merged));
    }
  }, [filters, setSearchParams]);

  const restoreFiltersFromStorage = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (Array.from(searchParams.keys()).length > 0) {
      return;
    }

    const stored = parseStoredFilters(window.sessionStorage.getItem(SCANNER_FILTERS_STORAGE_KEY));
    if (!stored) {
      return;
    }

    updateFilters(sanitizePartialFilters(stored));
  }, [searchParams, updateFilters]);

  return { filters, updateFilters, restoreFiltersFromStorage };
}
