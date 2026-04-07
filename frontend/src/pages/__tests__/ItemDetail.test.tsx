import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ItemDetail } from "../ItemDetail";

vi.mock("../../api/items", () => ({
  getItem: vi.fn(),
  getLiveItemListings: vi.fn(),
  refreshMetadata: vi.fn(),
}));

import { getItem, getLiveItemListings, refreshMetadata } from "../../api/items";

describe("ItemDetail page", () => {
  it("renders metadata status and live lookup controls", async () => {
    vi.mocked(getItem).mockResolvedValue({
      item_id: 873,
      name: "Staff of Jordan",
      class_name: "Weapon",
      subclass_name: null,
      quality: "Epic",
      icon_url: null,
      metadata_json: {},
      metadata_updated_at: new Date().toISOString(),
      is_commodity: false,
      metadata_status: "cached",
      metadata_message: "Metadata cached locally.",
      latest_listings: [],
      tsm_status: "available",
      tsm_message: "TSM region market stats loaded.",
      tsm_region_stats: {
        db_region_market_avg: 950000,
        db_region_historical: 870000,
        db_region_sale_avg: 910000,
        db_region_sale_rate: 0.042,
        db_region_sold_per_day: 0.315,
      },
      recent_scan: null,
    });
    vi.mocked(getLiveItemListings).mockResolvedValue({
      provider_name: "blizzard_auctions",
      status: "available",
      message: "Live Blizzard lookup returned 1 tracked realm listings for item 873.",
      listings: [
        {
          realm: "Stormrage",
          lowest_price: 15000,
          average_price: 15500,
          quantity: 2,
          listing_count: 2,
          captured_at: new Date().toISOString(),
          source_name: "blizzard_auctions_live",
        },
      ],
    });
    vi.mocked(refreshMetadata).mockResolvedValue({ refreshed_count: 1, warnings: [] });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/items/873"]}>
          <Routes>
            <Route path="/items/:itemId" element={<ItemDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Staff of Jordan")).toBeInTheDocument();
    expect(screen.getByText("Cached metadata")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh live metadata" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check live Blizzard listings" })).toBeInTheDocument();
    expect(screen.getByText("TSM market stats")).toBeInTheDocument();
    expect(screen.getByText("Region sale rate")).toBeInTheDocument();
    expect(screen.getByText("4.2%")).toBeInTheDocument();
  });
});
