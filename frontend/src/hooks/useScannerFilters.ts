import { useSearchParams } from "react-router-dom";
import type { ScannerFilters } from "../types/models";

export function useScannerFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: ScannerFilters = {
    minProfit: searchParams.get("minProfit") ?? "",
    minRoi: searchParams.get("minRoi") ?? "",
    maxBuyPrice: searchParams.get("maxBuyPrice") ?? "",
    minConfidence: searchParams.get("minConfidence") ?? "",
    category: searchParams.get("category") ?? "",
    allowStale: searchParams.get("allowStale") === "true",
    hideRisky: searchParams.get("hideRisky") !== "false",
    sortBy: (searchParams.get("sortBy") as ScannerFilters["sortBy"]) ?? "final_score",
  };

  function updateFilters(next: Partial<ScannerFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value === "" || value === false || value === undefined || value === null) {
        return;
      }
      params.set(key, String(value));
    });
    setSearchParams(params, { replace: true });
  }

  return { filters, updateFilters };
}

