import { render, screen } from "@testing-library/react";
import { ProviderStatusCard } from "../ProviderStatusCard";

describe("ProviderStatusCard", () => {
  it("renders cached-only provider state", () => {
    render(
      <ProviderStatusCard
        provider={{
          name: "blizzard_metadata",
          provider_type: "metadata",
          status: "cached_only",
          available: false,
          supports_live_fetch: true,
          message: "12 cached item records available for offline metadata lookups.",
          cache_records: 12,
          last_checked_at: null,
          last_error: null,
        }}
      />,
    );

    expect(screen.getByText("Cached only")).toBeInTheDocument();
    expect(screen.getByText("12 cached")).toBeInTheDocument();
    expect(screen.getByText("Live fetch")).toBeInTheDocument();
  });

  it("renders unavailable provider state", () => {
    render(
      <ProviderStatusCard
        provider={{
          name: "blizzard_auctions",
          provider_type: "listing",
          status: "unavailable",
          available: false,
          supports_live_fetch: true,
          message: "No Blizzard Battle.net client credentials are configured.",
          cache_records: 0,
          last_checked_at: null,
          last_error: null,
        }}
      />,
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/client credentials/i)).toBeInTheDocument();
    expect(screen.getByText("Live fetch")).toBeInTheDocument();
  });

  it("renders non-live listing providers as unavailable for bulk scanning", () => {
    render(
      <ProviderStatusCard
        provider={{
          name: "legacy_listing_source",
          provider_type: "listing",
          status: "available",
          available: true,
          supports_live_fetch: false,
          message: "This provider cannot refresh live Blizzard listings.",
          cache_records: 0,
          last_checked_at: null,
          last_error: null,
        }}
      />,
    );

    expect(screen.getByText("Bulk scan unavailable")).toBeInTheDocument();
  });
});
