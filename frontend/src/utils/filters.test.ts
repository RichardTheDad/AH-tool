import { describe, expect, it } from "vitest";
import type { ScanResult, ScannerFilters } from "../types/models";
import { filterScanResults } from "./filters";

const baseFilters: ScannerFilters = {
  minProfit: "",
  minRoi: "",
  minSpread: "",
  maxSpread: "",
  maxBuyPrice: "",
  minConfidence: "",
  category: "",
  subcategory: "",
  buyRealm: "",
  sellRealm: "",
  hideRisky: false,
  sortBy: "final_score",
  sortDirection: "desc",
};

function result(overrides: Partial<ScanResult>): ScanResult {
  return {
    id: 1,
    item_id: 1,
    item_name: "Test Item",
    item_class_name: "Armor",
    item_subclass_name: "Leather",
    cheapest_buy_realm: "Stormrage",
    cheapest_buy_price: 100,
    best_sell_realm: "Area 52",
    best_sell_price: 200,
    estimated_profit: 90,
    roi: 0.9,
    spread_percent: 1,
    confidence_score: 80,
    sellability_score: 70,
    liquidity_score: 70,
    volatility_score: 20,
    bait_risk_score: 10,
    final_score: 80,
    turnover_label: "steady",
    explanation: "Test result",
    sell_history_prices: [],
    generated_at: new Date(0).toISOString(),
    has_stale_data: false,
    is_risky: false,
    has_missing_metadata: false,
    ...overrides,
  };
}

describe("filterScanResults", () => {
  it("treats the Battle Pets category as all pet-style results", () => {
    const rows = [
      result({ id: 1, item_name: "Pet Cage", item_class_name: "Battle Pets", item_subclass_name: "BattlePet" }),
      result({ id: 2, item_name: "Darkmoon Rabbit", item_class_name: "Miscellaneous", item_subclass_name: "Companion Pets" }),
      result({ id: 3, item_name: "Commander Helm", item_class_name: "Armor", item_subclass_name: "Plate" }),
    ];

    const filtered = filterScanResults(rows, { ...baseFilters, category: "Battle Pets" });

    expect(filtered.map((row) => row.id).sort()).toEqual([1, 2]);
  });
});
