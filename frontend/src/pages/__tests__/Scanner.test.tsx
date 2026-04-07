import { fireEvent, screen, within } from "@testing-library/react";
import { Scanner } from "../Scanner";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../api/scans", () => ({
  getLatestScan: vi.fn(),
  getScanReadiness: vi.fn(),
  getScanStatus: vi.fn(),
  runScan: vi.fn(),
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
}));

import { getLatestScan, getScanReadiness, getScanStatus, runScan } from "../../api/scans";
import { refreshMissingMetadata } from "../../api/items";
import { getProviderStatus } from "../../api/providers";
import { getRealms } from "../../api/realms";
import { getPresets } from "../../api/presets";

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
    vi.mocked(runScan).mockResolvedValue({
      id: 1,
      provider_name: "file_import",
      generated_at: new Date().toISOString(),
      result_count: 0,
      results: [],
    });
    vi.mocked(refreshMissingMetadata).mockResolvedValue({ refreshed_count: 0, warnings: [] });
    vi.mocked(getProviderStatus).mockResolvedValue(providerResponse);
    vi.mocked(getRealms).mockResolvedValue([{ id: 1, realm_name: "Stormrage", region: "us", enabled: true }]);
    vi.mocked(getPresets).mockResolvedValue([]);
    vi.mocked(getScanReadiness).mockResolvedValue(readinessResponse);
    vi.mocked(getScanStatus).mockResolvedValue(scanStatusResponse);
  });

  it("renders failure state when scanner data fails", async () => {
    vi.mocked(getLatestScan).mockRejectedValue(new Error("boom"));

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByText("Scanner data could not be loaded.")).toBeInTheDocument();
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
            estimated_profit: 9805,
            roi: 0.76,
            confidence_score: 92,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 90,
            explanation: "Cheapest on Area 52, strongest sell on Zul'jin, with acceptable liquidity.",
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
          },
        ],
      },
    });

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByText("Staff of Jordan")).toBeInTheDocument();
    expect(screen.getByText("Enabled realms have enough local listing coverage for a trustworthy scan.")).toBeInTheDocument();
    expect(screen.getByText("Import CSV or JSON listing snapshots to provide scanner data.")).toBeInTheDocument();

    const selector = screen.getByDisplayValue("file_import");
    const options = within(selector).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("file_import");
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
    expect(screen.getByText(/Import listing snapshots for your enabled realms/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run scan" })).toBeDisabled();
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
            estimated_profit: 9805,
            roi: 0.76,
            confidence_score: 92,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 90,
            explanation: "Cheapest on Area 52, strongest sell on Zul'jin, with acceptable liquidity.",
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
          },
        ],
      },
    });
    vi.mocked(getPresets).mockResolvedValue([
      {
        id: 1,
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

  it("supports category dropdown and clickable header sorting", async () => {
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
            estimated_profit: 9805,
            roi: 0.76,
            confidence_score: 92,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 90,
            explanation: "Cheapest on Area 52, strongest sell on Zul'jin, with acceptable liquidity.",
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
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
            estimated_profit: 5055,
            roi: 0.702,
            confidence_score: 98,
            liquidity_score: 88,
            volatility_score: 86,
            bait_risk_score: 18,
            final_score: 95,
            explanation: "Cheapest on Stormrage, strongest sell on Zul'jin, with acceptable liquidity.",
            generated_at: new Date().toISOString(),
            has_stale_data: false,
            is_risky: false,
          },
        ],
      },
    });

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByRole("option", { name: "Weapon" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Armor" })).toBeInTheDocument();

    const buyPriceHeader = screen.getByRole("button", { name: /Buy price/i });
    fireEvent.click(buyPriceHeader);
    expect(buyPriceHeader).toHaveTextContent("Buy price v");

    fireEvent.click(buyPriceHeader);
    expect(buyPriceHeader).toHaveTextContent("Buy price ^");
  });
});
