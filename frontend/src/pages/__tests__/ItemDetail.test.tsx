import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ItemDetail } from "../ItemDetail";

vi.mock("../../api/items", () => ({
  getItem: vi.fn(),
  getLiveItemListings: vi.fn(),
}));

import { getItem, getLiveItemListings } from "../../api/items";

describe("ItemDetail page", () => {
  it("renders item detail and live lookup controls", async () => {
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
      auction_history: [
        {
          realm: "Stormrage",
          points: [
            {
              captured_at: new Date(Date.now() - 86_400_000).toISOString(),
              lowest_price: 900000,
              average_price: 940000,
              quantity: 2,
              listing_count: 2,
            },
            {
              captured_at: new Date().toISOString(),
              lowest_price: 950000,
              average_price: 960000,
              quantity: 3,
              listing_count: 3,
            },
          ],
        },
      ],
      tsm_status: "available",
      tsm_message: "TSM region market stats loaded.",
      tsm_region_stats: {
        db_region_market_avg: 950000,
        db_region_historical: 870000,
        db_region_sale_avg: 910000,
        db_region_sale_rate: 0.042,
        db_region_sold_per_day: 0.315,
      },
      tsm_realm_stats: [
        {
          realm: "Stormrage",
          min_buyout: 920000,
          num_auctions: 3,
          market_value_recent: 940000,
          historical: 880000,
        },
      ],
      tsm_ledger_status: "available",
      tsm_ledger_message: "Local TSM ledger history loaded.",
      tsm_ledger_summary: {
        auction_sale_count: 2,
        auction_units_sold: 3,
        auction_avg_unit_sale_price: 137500,
        last_auction_sale_at: new Date().toISOString(),
        auction_buy_count: 1,
        auction_units_bought: 1,
        auction_avg_unit_buy_price: 95000,
        last_auction_buy_at: new Date().toISOString(),
        cancel_count: 1,
        expired_count: 0,
        last_cancel_at: new Date().toISOString(),
        last_expired_at: null,
        recent_sales: [
          {
            realm: "Stormrage",
            quantity: 2,
            price: 150000,
            other_player: "Buyerone",
            player: "Divineares",
            time: new Date().toISOString(),
            source: "Auction",
          },
        ],
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
    expect(screen.getByRole("button", { name: "Check live Blizzard listings" })).toBeInTheDocument();
    expect(screen.getByText("Auction history")).toBeInTheDocument();
    expect(screen.getByText("TSM market context")).toBeInTheDocument();
    expect(screen.getByText("Region sale rate")).toBeInTheDocument();
    expect(screen.getByText("4.2%")).toBeInTheDocument();
    expect(screen.getByText("Tracked realm AuctionDB context")).toBeInTheDocument();
    expect(screen.getByText("TSM recent")).toBeInTheDocument();
    expect(screen.getByText("Personal TSM ledger")).toBeInTheDocument();
    expect(screen.getByText("Avg unit sold")).toBeInTheDocument();
    expect(screen.getByText("Recent personal auction sales")).toBeInTheDocument();
  });
});
