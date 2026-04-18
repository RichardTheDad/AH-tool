import { waitFor } from "@testing-library/react";
import { Scanner } from "../Scanner";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

vi.mock("../../api/scans", () => ({
  getLatestScan: vi.fn(),
  getScan: vi.fn(),
  getScanCalibration: vi.fn(),
  getScanHistory: vi.fn(),
  getScanReadiness: vi.fn(),
  getScanStatus: vi.fn(),
}));

vi.mock("../../api/settings", () => ({
  applyTuningPreset: vi.fn(),
  getTuningAudit: vi.fn(),
}));

vi.mock("../../api/items", () => ({
  refreshMissingMetadata: vi.fn(),
}));

vi.mock("../../api/providers", () => ({
  getProviderStatus: vi.fn(),
}));

vi.mock("../../api/realms", () => ({
  getRealms: vi.fn(),
}));

vi.mock("../../api/presets", () => ({
  getPresets: vi.fn(),
  getDefaultPreset: vi.fn(),
}));

import { getLatestScan, getScan, getScanCalibration, getScanHistory, getScanReadiness, getScanStatus } from "../../api/scans";
import { refreshMissingMetadata } from "../../api/items";
import { getProviderStatus } from "../../api/providers";
import { getRealms } from "../../api/realms";
import { getDefaultPreset, getPresets } from "../../api/presets";
import { applyTuningPreset, getTuningAudit } from "../../api/settings";
import { TRACKED_REALMS_FILTER_VALUE } from "../../utils/filters";

describe("Scanner realm filter restore hardening", () => {
  beforeEach(() => {
    window.sessionStorage.clear();

    vi.mocked(refreshMissingMetadata).mockResolvedValue({ queued_count: 0, warnings: [] });
    vi.mocked(getProviderStatus).mockResolvedValue({
      providers: [
        {
          name: "blizzard_auctions",
          provider_type: "listing",
          status: "available",
          available: true,
          supports_live_fetch: true,
          message: "ready",
          cache_records: 0,
          last_checked_at: null,
          last_error: null,
        },
      ],
    });
    vi.mocked(getRealms).mockResolvedValue([
      { id: 1, realm_name: "Stormrage", region: "us", enabled: true },
      { id: 2, realm_name: "Area 52", region: "us", enabled: true },
    ]);
    vi.mocked(getPresets).mockResolvedValue([]);
    vi.mocked(getDefaultPreset).mockResolvedValue(null);
    vi.mocked(getScan).mockResolvedValue({
      id: 2,
      provider_name: "blizzard_auctions",
      generated_at: new Date().toISOString(),
      result_count: 0,
      results: [],
      available_item_classes: [],
      available_realms: [],
      available_category_pairs: [],
    });
    vi.mocked(getScanCalibration).mockResolvedValue({
      total_evaluated: 0,
      confidence_bands: [],
      sellability_bands: [],
      horizons: [],
      trends: [],
      suggestions: [],
    });
    vi.mocked(getScanHistory).mockResolvedValue({ scans: [] });
    vi.mocked(getScanReadiness).mockResolvedValue({
      status: "ready",
      ready_for_scan: true,
      message: "ready",
      enabled_realm_count: 2,
      realms_with_data: 2,
      realms_with_fresh_data: 2,
      unique_item_count: 2,
      items_missing_metadata: 0,
      stale_realm_count: 0,
      missing_realms: [],
      stale_realms: [],
      oldest_snapshot_at: new Date().toISOString(),
      latest_snapshot_at: new Date().toISOString(),
      realms: [
        {
          realm: "Stormrage",
          has_data: true,
          fresh_item_count: 2,
          stale_item_count: 0,
          latest_item_count: 2,
          freshest_captured_at: new Date().toISOString(),
          latest_source_name: "blizzard_auctions",
        },
      ],
    });
    vi.mocked(getScanStatus).mockResolvedValue({
      status: "idle",
      message: "ok",
      provider_name: "blizzard_auctions",
      started_at: null,
      finished_at: null,
      next_scheduled_at: null,
      diagnostic_active_scope: "tracked_realms",
      diagnostic_buy_filter: null,
      diagnostic_sell_filter: null,
      diagnostic_tracked_realm_count: 2,
      diagnostic_latest_scan_id: 1,
      diagnostic_latest_scan_result_count: 2,
      diagnostic_latest_buy_realm_count: 2,
      diagnostic_latest_sell_realm_count: 2,
    });
    vi.mocked(getTuningAudit).mockResolvedValue({ entries: [] });
    vi.mocked(applyTuningPreset).mockResolvedValue({
      id: 1,
      ah_cut_percent: 0.05,
      flat_buffer: 50,
      refresh_interval_minutes: 65,
      stale_after_minutes: 90,
      scoring_preset: "balanced",
      non_commodity_only: true,
    });
    vi.mocked(getLatestScan).mockResolvedValue({
      latest: {
        id: 1,
        provider_name: "blizzard_auctions",
        generated_at: new Date().toISOString(),
        result_count: 1,
        results: [
          {
            id: 10,
            item_id: 100,
            item_name: "Test",
            item_class_name: "Weapon",
            cheapest_buy_realm: "Stormrage",
            cheapest_buy_price: 100,
            best_sell_realm: "Area 52",
            best_sell_price: 200,
            observed_sell_price: 200,
            estimated_profit: 80,
            roi: 0.8,
            confidence_score: 90,
            sellability_score: 80,
            liquidity_score: 75,
            volatility_score: 10,
            bait_risk_score: 5,
            final_score: 95,
            turnover_label: "fast",
            explanation: "ok",
            sell_history_prices: [200],
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
            has_missing_metadata: false,
          },
        ],
        available_item_classes: [],
        available_realms: [],
        available_category_pairs: [],
      },
    });
  });

  it("auto-resets invalid URL realm filters to tracked defaults", async () => {
    renderWithProviders(<Scanner />, "/scanner?buyRealm=MissingRealm&sellRealm=UnknownRealm");

    await waitFor(() => {
      const buy = document.getElementById("scanner-filter-buy-realm") as HTMLSelectElement | null;
      const sell = document.getElementById("scanner-filter-sell-realm") as HTMLSelectElement | null;
      expect(buy?.value).toBe(TRACKED_REALMS_FILTER_VALUE);
      expect(sell?.value).toBe(TRACKED_REALMS_FILTER_VALUE);
    });
  });

  it("invalid saved realm filter auto-resets to tracked defaults", async () => {
    window.sessionStorage.setItem(
      "scanner.filters.v1",
      JSON.stringify({ buyRealm: "OldRealm", sellRealm: "LegacyRealm", sortBy: "final_score", sortDirection: "desc" }),
    );

    renderWithProviders(<Scanner />, "/scanner");

    await waitFor(() => {
      const buy = document.getElementById("scanner-filter-buy-realm") as HTMLSelectElement | null;
      const sell = document.getElementById("scanner-filter-sell-realm") as HTMLSelectElement | null;
      expect(buy?.value).toBe(TRACKED_REALMS_FILTER_VALUE);
      expect(sell?.value).toBe(TRACKED_REALMS_FILTER_VALUE);
    });
  });
});
