import { fireEvent, screen } from "@testing-library/react";
import { Scanner } from "../Scanner";
import { renderWithProviders } from "../../test/test-utils";

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

const providerResponse = {
  providers: [
    {
      name: "blizzard_auctions",
      provider_type: "listing",
      status: "unavailable" as const,
      available: false,
      supports_live_fetch: true,
      message: "No Blizzard Battle.net client credentials are configured.",
      cache_records: 0,
      last_checked_at: null,
      last_error: null,
    },
    {
      name: "file_import",
      provider_type: "listing",
      status: "available" as const,
      available: true,
      supports_live_fetch: false,
      message: "Import CSV or JSON listing snapshots to provide scanner data.",
      cache_records: 0,
      last_checked_at: null,
      last_error: null,
    },
  ],
};

const readinessResponse = {
  status: "ready" as const,
  ready_for_scan: true,
  message: "Enabled realms have enough local listing coverage for a trustworthy scan.",
  enabled_realm_count: 1,
  realms_with_data: 1,
  realms_with_fresh_data: 1,
  unique_item_count: 1,
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
      fresh_item_count: 1,
      stale_item_count: 0,
      latest_item_count: 1,
      freshest_captured_at: new Date().toISOString(),
      latest_source_name: "file_import",
    },
  ],
};

const scanStatusResponse = {
  status: "idle" as const,
  message: "Scanner is idle.",
  provider_name: "file_import",
  started_at: null,
  finished_at: null,
};

describe("Scanner page", () => {
  beforeEach(() => {
    vi.mocked(refreshMissingMetadata).mockResolvedValue({ queued_count: 0, warnings: [] });
    vi.mocked(getProviderStatus).mockResolvedValue(providerResponse);
    vi.mocked(getRealms).mockResolvedValue([{ id: 1, realm_name: "Stormrage", region: "us", enabled: true }]);
    vi.mocked(getPresets).mockResolvedValue([]);
    vi.mocked(getDefaultPreset).mockResolvedValue(null);
    vi.mocked(getScan).mockResolvedValue({
      id: 2,
      provider_name: "file_import",
      generated_at: new Date().toISOString(),
      result_count: 0,
      results: [],
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
    vi.mocked(getScanReadiness).mockResolvedValue(readinessResponse);
    vi.mocked(getScanStatus).mockResolvedValue(scanStatusResponse);
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
  });

  it("renders scanner shell when latest scan request fails", async () => {
    vi.mocked(getLatestScan).mockRejectedValue(new Error("boom"));

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByText("Current opportunities")).toBeInTheDocument();
  });

  it("renders scan results and only offers scan-usable providers", async () => {
    vi.mocked(getLatestScan).mockResolvedValue({
      latest: {
        id: 1,
        provider_name: "file_import",
        generated_at: new Date().toISOString(),
        result_count: 1,
        results: [
          {
            id: 10,
            item_id: 873,
            item_name: "Staff of Jordan",
            item_class_name: "Weapon",
            cheapest_buy_realm: "Area 52",
            cheapest_buy_price: 12900,
            best_sell_realm: "Zul'jin",
            best_sell_price: 23900,
            observed_sell_price: 24500,
            estimated_profit: 9805,
            roi: 0.76,
            confidence_score: 92,
            sellability_score: 88,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 90,
            turnover_label: "steady",
            explanation: "Cheapest on Area 52, strongest sell on Zul'jin, with acceptable liquidity.",
            sell_history_prices: [23900, 23000, 22000],
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
            has_missing_metadata: false,
          },
        ],
      },
    });

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByText("Staff of Jordan")).toBeInTheDocument();
    expect(screen.getByText("Enabled realms have enough local listing coverage for a trustworthy scan.")).toBeInTheDocument();
  });

  it("renders import-required state when enabled realms have no listing data", async () => {
    vi.mocked(getLatestScan).mockResolvedValue({ latest: null });
    vi.mocked(getScanReadiness).mockResolvedValue({
      ...readinessResponse,
      status: "blocked",
      ready_for_scan: false,
      message: "At least two enabled realms need listing data before the scanner can compare flip opportunities.",
      realms_with_data: 0,
      realms_with_fresh_data: 0,
      unique_item_count: 0,
      realms: [{ ...readinessResponse.realms[0], has_data: false, fresh_item_count: 0, latest_item_count: 0, freshest_captured_at: null }],
    });

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByText("No listing data found")).toBeInTheDocument();
    expect(screen.getByText(/Live Blizzard listing refresh is not available right now/)).toBeInTheDocument();
  });

  it("shows when a quick preset has been applied", async () => {
    vi.mocked(getLatestScan).mockResolvedValue({
      latest: {
        id: 1,
        provider_name: "file_import",
        generated_at: new Date().toISOString(),
        result_count: 1,
        results: [
          {
            id: 10,
            item_id: 873,
            item_name: "Staff of Jordan",
            item_class_name: "Weapon",
            cheapest_buy_realm: "Area 52",
            cheapest_buy_price: 12900,
            best_sell_realm: "Zul'jin",
            best_sell_price: 23900,
            observed_sell_price: 24500,
            estimated_profit: 9805,
            roi: 0.76,
            confidence_score: 92,
            sellability_score: 88,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 90,
            turnover_label: "steady",
            explanation: "Cheapest on Area 52, strongest sell on Zul'jin, with acceptable liquidity.",
            sell_history_prices: [23900, 23000, 22000],
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
            has_missing_metadata: false,
          },
        ],
      },
    });
    vi.mocked(getPresets).mockResolvedValue([
      {
        id: 1,
        is_default: true,
        name: "Balanced Board",
        min_profit: 2500,
        min_roi: 0.12,
        max_buy_price: 50000,
        min_confidence: 55,
        allow_stale: false,
        hide_risky: true,
        category_filter: "Weapon",
      },
    ]);

    renderWithProviders(<Scanner />, "/scanner");

    const button = await screen.findByRole("button", { name: "Balanced Board" });
    fireEvent.click(button);

    expect(await screen.findByText("Applied preset: Balanced Board")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("highlights Aggressive Peek when it is selected", async () => {
    vi.mocked(getLatestScan).mockResolvedValue({
      latest: {
        id: 1,
        provider_name: "file_import",
        generated_at: new Date().toISOString(),
        result_count: 1,
        results: [
          {
            id: 10,
            item_id: 873,
            item_name: "Staff of Jordan",
            item_class_name: "Weapon",
            cheapest_buy_realm: "Area 52",
            cheapest_buy_price: 12900,
            best_sell_realm: "Zul'jin",
            best_sell_price: 23900,
            observed_sell_price: 24500,
            estimated_profit: 9805,
            roi: 0.76,
            confidence_score: 92,
            sellability_score: 70,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 90,
            turnover_label: "steady",
            explanation: "Cheapest on Area 52, strongest sell on Zul'jin, with acceptable liquidity.",
            sell_history_prices: [23900, 23000, 22000],
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
            has_missing_metadata: false,
          },
        ],
      },
    });
    vi.mocked(getPresets).mockResolvedValue([
      {
        id: 1,
        is_default: false,
        name: "Safe Floor",
        min_profit: 5000,
        min_roi: 0.2,
        max_buy_price: null,
        min_confidence: 70,
        allow_stale: false,
        hide_risky: true,
        category_filter: null,
      },
      {
        id: 2,
        is_default: false,
        name: "Balanced Board",
        min_profit: 2500,
        min_roi: 0.12,
        max_buy_price: null,
        min_confidence: 55,
        allow_stale: false,
        hide_risky: true,
        category_filter: null,
      },
      {
        id: 3,
        is_default: false,
        name: "Aggressive Peek",
        min_profit: 1000,
        min_roi: 0.08,
        max_buy_price: null,
        min_confidence: 35,
        allow_stale: false,
        hide_risky: false,
        category_filter: null,
      },
    ]);

    renderWithProviders(<Scanner />, "/scanner");

    const button = await screen.findByRole("button", { name: "Aggressive Peek" });
    fireEvent.click(button);

    expect(await screen.findByText("Applied preset: Aggressive Peek")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("supports category and sort controls", async () => {
    vi.mocked(getLatestScan).mockResolvedValue({
      latest: {
        id: 1,
        provider_name: "file_import",
        generated_at: new Date().toISOString(),
        result_count: 2,
        results: [
          {
            id: 10,
            item_id: 873,
            item_name: "Staff of Jordan",
            item_class_name: "Weapon",
            cheapest_buy_realm: "Area 52",
            cheapest_buy_price: 12900,
            best_sell_realm: "Zul'jin",
            best_sell_price: 23900,
            observed_sell_price: 24500,
            estimated_profit: 9805,
            roi: 0.76,
            confidence_score: 92,
            sellability_score: 88,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 90,
            turnover_label: "steady",
            explanation: "Cheapest on Area 52, strongest sell on Zul'jin, with acceptable liquidity.",
            sell_history_prices: [23900, 23000, 22000],
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
            has_missing_metadata: false,
          },
          {
            id: 11,
            item_id: 874,
            item_name: "Commander Helm",
            item_class_name: "Armor",
            cheapest_buy_realm: "Stormrage",
            cheapest_buy_price: 7200,
            best_sell_realm: "Zul'jin",
            best_sell_price: 12900,
            observed_sell_price: 13000,
            estimated_profit: 5055,
            roi: 0.702,
            confidence_score: 98,
            sellability_score: 91,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 95,
            turnover_label: "fast",
            explanation: "Cheapest on Stormrage, strongest sell on Zul'jin, with acceptable liquidity.",
            sell_history_prices: [12900, 12000],
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
            has_missing_metadata: false,
          },
        ],
      },
    });

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByRole("option", { name: "Weapon" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Armor" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Final score" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Highest to lowest" })).toBeInTheDocument();
  });

  it("applies hard filters that remove non-matching rows", async () => {
    vi.mocked(getLatestScan).mockResolvedValue({
      latest: {
        id: 1,
        provider_name: "file_import",
        generated_at: new Date().toISOString(),
        result_count: 2,
        results: [
          {
            id: 10,
            item_id: 873,
            item_name: "Staff of Jordan",
            item_class_name: "Weapon",
            cheapest_buy_realm: "Area 52",
            cheapest_buy_price: 12900,
            best_sell_realm: "Zul'jin",
            best_sell_price: 23900,
            observed_sell_price: 24500,
            estimated_profit: 9805,
            roi: 0.76,
            confidence_score: 92,
            sellability_score: 88,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 90,
            turnover_label: "steady",
            explanation: "Cheapest on Area 52, strongest sell on Zul'jin, with acceptable liquidity.",
            sell_history_prices: [23900, 23000, 22000],
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
            has_missing_metadata: false,
          },
          {
            id: 11,
            item_id: 874,
            item_name: "Commander Helm",
            item_class_name: "Armor",
            cheapest_buy_realm: "Stormrage",
            cheapest_buy_price: 7200,
            best_sell_realm: "Zul'jin",
            best_sell_price: 12900,
            observed_sell_price: 13000,
            estimated_profit: 5055,
            roi: 0.702,
            confidence_score: 98,
            sellability_score: 91,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 95,
            turnover_label: "fast",
            explanation: "Cheapest on Stormrage, strongest sell on Zul'jin, with acceptable liquidity.",
            sell_history_prices: [12900, 12000],
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
            has_missing_metadata: false,
          },
        ],
      },
    });

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByText("Staff of Jordan")).toBeInTheDocument();
    expect(screen.getByText("Commander Helm")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Min profit"), { target: { value: "9000" } });

    expect(screen.getByText("Staff of Jordan")).toBeInTheDocument();
    expect(screen.queryByText("Commander Helm")).not.toBeInTheDocument();
  });
});
