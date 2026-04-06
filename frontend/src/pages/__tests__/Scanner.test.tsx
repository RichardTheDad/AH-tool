import { screen, within } from "@testing-library/react";
import { Scanner } from "../Scanner";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../api/scans", () => ({
  getLatestScan: vi.fn(),
  runScan: vi.fn(),
}));

vi.mock("../../api/providers", () => ({
  getProviderStatus: vi.fn(),
}));

vi.mock("../../api/presets", () => ({
  getPresets: vi.fn(),
}));

import { getLatestScan, runScan } from "../../api/scans";
import { getProviderStatus } from "../../api/providers";
import { getPresets } from "../../api/presets";

const providerResponse = {
  providers: [
    {
      name: "file_import",
      provider_type: "listing",
      status: "available" as const,
      available: true,
      supports_live_fetch: false,
      message: "Ready for CSV and JSON snapshot imports.",
      cache_records: 0,
      last_checked_at: null,
      last_error: null,
    },
    {
      name: "saddlebag_public",
      provider_type: "listing",
      status: "unavailable" as const,
      available: false,
      supports_live_fetch: false,
      message: "Public Saddlebag WoW listings are exposed as per-item realm lookups. Bulk realm scans still require imported listing snapshots.",
      cache_records: 0,
      last_checked_at: null,
      last_error: null,
    },
  ],
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
    vi.mocked(getProviderStatus).mockResolvedValue(providerResponse);
    vi.mocked(getPresets).mockResolvedValue([]);
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
    expect(screen.getByText("Ready for CSV and JSON snapshot imports.")).toBeInTheDocument();

    const selector = screen.getByDisplayValue("file_import");
    const options = within(selector).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("file_import");
  });

  it("renders empty state when no scan results exist", async () => {
    vi.mocked(getLatestScan).mockResolvedValue({ latest: null });

    renderWithProviders(<Scanner />, "/scanner");

    expect(await screen.findByText("Scanner is empty")).toBeInTheDocument();
    expect(screen.getByText(/Import real listing snapshots/)).toBeInTheDocument();
  });
});
