import { describe, expect, it } from "vitest";
import type { ScanResult, ScannerFilters } from "../types/models";
import { ALL_REALMS_FILTER_VALUE, TRACKED_REALMS_FILTER_VALUE, filterScanResults } from "./filters";

const baseFilters: ScannerFilters = {
  minProfit: "",
  minRoi: "",
  minSpread: "",
  maxSpread: "",
  maxBuyPrice: "",
  minConfidence: "",
  category: "",
  subcategory: "",
  buyRealm: TRACKED_REALMS_FILTER_VALUE,
  sellRealm: TRACKED_REALMS_FILTER_VALUE,
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

  it("defaults realm filters to tracked realms and can expand to all realms", () => {
    const rows = [
      result({ id: 1, item_name: "Tracked Route", cheapest_buy_realm: "Stormrage", best_sell_realm: "Area 52" }),
      result({ id: 2, item_name: "Outside Buy", cheapest_buy_realm: "Illidan", best_sell_realm: "Area 52" }),
      result({ id: 3, item_name: "Outside Sell", cheapest_buy_realm: "Stormrage", best_sell_realm: "Zul'jin" }),
    ];

    const trackedOnly = filterScanResults(rows, baseFilters, { trackedRealms: ["Stormrage", "Area 52"] });
    const allRealms = filterScanResults(
      rows,
      { ...baseFilters, buyRealm: ALL_REALMS_FILTER_VALUE, sellRealm: ALL_REALMS_FILTER_VALUE },
      { trackedRealms: ["Stormrage", "Area 52"] },
    );

    expect(trackedOnly.map((row) => row.id)).toEqual([1]);
    expect(allRealms.map((row) => row.id).sort()).toEqual([1, 2, 3]);
  });

  it("keeps scheduled scanner rows when tracked scope comes from readiness realms", () => {
    const rows = [
      result({ id: 1, item_name: "Scheduled Route", cheapest_buy_realm: "Area 52", best_sell_realm: "Zul'jin" }),
      result({ id: 2, item_name: "Untracked Route", cheapest_buy_realm: "Illidan", best_sell_realm: "Tichondrius" }),
    ];

    const filtered = filterScanResults(rows, baseFilters, { trackedRealms: ["Area 52", "Zul'jin"] });

    expect(filtered.map((row) => row.id)).toEqual([1]);
  });

  it("falls back to tracked opportunities when strict tracked buy+sell scope would be empty", () => {
    const rows = [
      result({ id: 1, item_name: "Tracked Buy", cheapest_buy_realm: "Stormrage", best_sell_realm: "Illidan" }),
      result({ id: 2, item_name: "Tracked Sell", cheapest_buy_realm: "Tichondrius", best_sell_realm: "Area 52" }),
      result({ id: 3, item_name: "Untracked Route", cheapest_buy_realm: "Illidan", best_sell_realm: "Tichondrius" }),
    ];

    const filtered = filterScanResults(rows, baseFilters, { trackedRealms: ["Stormrage", "Area 52"] });

    expect(filtered.map((row) => row.id).sort()).toEqual([1, 2]);
  });

  it("matches individual realms despite casing and extra spaces", () => {
    const rows = [
      result({ id: 1, cheapest_buy_realm: "Area 52", best_sell_realm: "Zul'jin" }),
      result({ id: 2, cheapest_buy_realm: "Stormrage", best_sell_realm: "Zul'jin" }),
    ];

    const filtered = filterScanResults(
      rows,
      { ...baseFilters, buyRealm: " area 52 ", sellRealm: ALL_REALMS_FILTER_VALUE },
    );

    expect(filtered.map((row) => row.id)).toEqual([1]);
  });
});
