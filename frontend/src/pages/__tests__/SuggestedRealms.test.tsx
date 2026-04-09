import { fireEvent, screen, waitFor } from "@testing-library/react";
import { SuggestedRealms } from "../SuggestedRealms";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../api/realms", () => ({
  getRealms: vi.fn(),
  createRealm: vi.fn(),
  updateRealm: vi.fn(),
}));

vi.mock("../../api/realmSuggestions", () => ({
  getLatestSuggestedRealms: vi.fn(),
  runSuggestedRealms: vi.fn(),
}));

import { createRealm, getRealms, updateRealm } from "../../api/realms";
import { getLatestSuggestedRealms, runSuggestedRealms } from "../../api/realmSuggestions";

describe("SuggestedRealms page", () => {
  beforeEach(() => {
    vi.mocked(getRealms).mockResolvedValue([
      { id: 1, realm_name: "Stormrage", region: "us", enabled: true },
      { id: 2, realm_name: "Zul'jin", region: "us", enabled: true },
    ]);
    vi.mocked(createRealm).mockResolvedValue({ id: 3, realm_name: "Area 52", region: "us", enabled: true });
    vi.mocked(updateRealm).mockResolvedValue({ id: 2, realm_name: "Zul'jin", region: "us", enabled: true });
    vi.mocked(runSuggestedRealms).mockResolvedValue({
      generated_at: new Date().toISOString(),
      target_realms: ["Stormrage", "Zul'jin"],
      source_realm_count: 200,
      warning_text: null,
      recommendations: [],
    });
  });

  it("renders suggestion cards and triggers refresh", async () => {
    vi.mocked(getLatestSuggestedRealms).mockResolvedValue({
      latest: {
        generated_at: new Date().toISOString(),
        target_realms: ["Stormrage", "Zul'jin"],
        source_realm_count: 200,
        warning_text: null,
        recommendations: [
          {
            realm: "Area 52",
            opportunity_count: 8,
            cheapest_source_count: 4,
            average_profit: 14500,
            average_roi: 0.42,
            average_confidence: 82,
            average_sellability: 76,
            consistency_score: 81,
            latest_captured_at: new Date().toISOString(),
            appearance_count: 3,
            cheap_run_count: 2,
            window_size: 3,
            recent_run_count: 4,
            median_buy_price: 120000,
            best_target_realm: "Stormrage",
            last_seen_cheapest_at: new Date().toISOString(),
            is_tracked: false,
            explanation: "Area 52 repeatedly undercuts other realms and still maps to believable sell-through on your selected targets.",
            top_items: [
              {
                item_id: 19019,
                item_name: "Thunderfury Plans",
                target_realm: "Stormrage",
                buy_price: 120000,
                target_sell_price: 185000,
                estimated_profit: 55750,
                roi: 0.46,
                confidence_score: 84,
                sellability_score: 78,
                turnover_label: "steady",
              },
            ],
          },
        ],
      },
    });

    renderWithProviders(<SuggestedRealms />, "/suggested-realms");

    expect((await screen.findAllByText("Area 52")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Thunderfury Plans/)).toBeInTheDocument();
    expect(screen.getByText("3/3 eligible runs")).toBeInTheDocument();
    expect(screen.getByText("2/3 eligible runs")).toBeInTheDocument();
    expect(screen.getByText(/Usually routes best into Stormrage/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh suggestions" }));
    await waitFor(() => expect(runSuggestedRealms).toHaveBeenCalledWith(["Stormrage", "Zul'jin"]));

    fireEvent.click(screen.getByRole("button", { name: "Track realm" }));
    await waitFor(() => expect(createRealm).toHaveBeenCalledWith({ realm_name: "Area 52", region: "us", enabled: true }));
  });
});
