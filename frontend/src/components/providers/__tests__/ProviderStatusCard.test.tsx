import { render, screen } from "@testing-library/react";
import { ProviderStatusCard } from "../ProviderStatusCard";

describe("ProviderStatusCard", () => {
  it("renders cached-only provider state", () => {
    render(
      <ProviderStatusCard
        provider={{
          name: "saddlebag_public_metadata",
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
  });

  it("renders unavailable provider state", () => {
    render(
      <ProviderStatusCard
        provider={{
          name: "saddlebag_public",
          provider_type: "listing",
          status: "unavailable",
          available: false,
          supports_live_fetch: false,
          message: "Public Saddlebag WoW listings are exposed as per-item realm lookups.",
          cache_records: 0,
          last_checked_at: null,
          last_error: null,
        }}
      />,
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/per-item realm lookups/i)).toBeInTheDocument();
  });
});
