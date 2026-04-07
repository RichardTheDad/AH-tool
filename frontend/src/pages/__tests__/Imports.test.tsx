import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Imports } from "../Imports";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../api/imports", () => ({
  importListings: vi.fn(),
}));

import { importListings } from "../../api/imports";


describe("Imports page", () => {
  it("shows validation errors from preview", async () => {
    vi.mocked(importListings).mockResolvedValue({
      committed: false,
      provider_name: "file_import",
      accepted_count: 0,
      inserted_count: 0,
      skipped_duplicates: 0,
      metadata_refreshed_count: 0,
      preview_rows: [],
      errors: [{ row_number: 2, message: "lowest_price is required" }],
      untracked_realms: [],
      coverage: {
        realm_count: 0,
        unique_item_count: 0,
        oldest_captured_at: null,
        latest_captured_at: null,
        enabled_realms_covered: 0,
        missing_enabled_realms: [],
      },
      summary: "Validated 0 rows and found 1 errors.",
      warning: "Fix validation errors before committing the import.",
    });

    renderWithProviders(<Imports />, "/imports");
    const user = userEvent.setup();
    const input = screen.getByLabelText("Listing file");

    await user.upload(input, new File(["data"], "bad.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByText("Row 2: lowest_price is required")).toBeInTheDocument();
  });

  it("shows import summary for valid uploads", async () => {
    vi.mocked(importListings).mockResolvedValue({
      committed: true,
      provider_name: "file_import",
      accepted_count: 2,
      inserted_count: 1,
      skipped_duplicates: 1,
      metadata_refreshed_count: 1,
      preview_rows: [
        {
          row_number: 1,
          item_id: 873,
          realm: "Stormrage",
          lowest_price: 15000,
          average_price: 15500,
          quantity: 2,
          listing_count: 2,
          captured_at: new Date().toISOString(),
        },
      ],
      errors: [],
      untracked_realms: ["Zul'jin"],
      coverage: {
        realm_count: 2,
        unique_item_count: 1,
        oldest_captured_at: new Date().toISOString(),
        latest_captured_at: new Date().toISOString(),
        enabled_realms_covered: 1,
        missing_enabled_realms: ["Stormrage"],
      },
      summary: "Imported 1 listing rows from 2 validated rows.",
      warning: "Imported realms not currently tracked: Zul'jin.",
    });

    renderWithProviders(<Imports />, "/imports");
    const user = userEvent.setup();
    const input = screen.getByLabelText("Listing file");

    await user.upload(input, new File(["data"], "good.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "Commit import" }));

    expect(await screen.findByText(/Imported 1 listing rows and skipped 1 duplicates/)).toBeInTheDocument();
    expect(screen.getByText("Imported realms not currently tracked: Zul'jin")).toBeInTheDocument();
    expect(screen.getByText("Pulled live Blizzard metadata for 1 imported items.")).toBeInTheDocument();
    expect(screen.getByText("2 realms / 1 items")).toBeInTheDocument();
    expect(screen.getByText(/Missing tracked realms: Stormrage/)).toBeInTheDocument();
  });
});
