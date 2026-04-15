import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { ScannerFilters } from "../types/models";

const SCANNER_FILTERS_STORAGE_KEY = "scanner.filters.v1";

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

function toBoolean(value: string | null, defaultValue = false): boolean {
  if (value === null) {
    return defaultValue;
  }
  return value === "true" || value === "1";
}

export function useScannerFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: ScannerFilters = {
    minProfit: searchParams.get("minProfit") ?? "",
    minRoi: searchParams.get("minRoi") ?? "",
    maxBuyPrice: searchParams.get("maxBuyPrice") ?? "",
    minConfidence: searchParams.get("minConfidence") ?? "",
    category: searchParams.get("category") ?? "",
    hideRisky: toBoolean(searchParams.get("hideRisky"), false),
    sortBy: (searchParams.get("sortBy") as ScannerFilters["sortBy"]) ?? "final_score",
    sortDirection: (searchParams.get("sortDirection") as ScannerFilters["sortDirection"]) ?? "desc",
  };

  const updateFilters = useCallback((next: Partial<ScannerFilters>) => {
    const merged = { ...filters, ...next };
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

    updateFilters(stored);
  }, [searchParams, updateFilters]);

  return { filters, updateFilters, restoreFiltersFromStorage };
}
