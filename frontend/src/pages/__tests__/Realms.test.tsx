import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Realms } from "../Realms";
import { renderWithProviders } from "../../test/test-utils";

vi.mock("../../api/realms", () => ({
  getRealms: vi.fn(),
  createRealm: vi.fn(),
  updateRealm: vi.fn(),
  deleteRealm: vi.fn(),
}));

import { createRealm, deleteRealm, getRealms, updateRealm } from "../../api/realms";

describe("Realms page", () => {
  it("blocks duplicate realm entries before submit", async () => {
    vi.mocked(getRealms).mockResolvedValue([{ id: 1, realm_name: "Stormrage", region: "us", enabled: true }]);
    vi.mocked(createRealm).mockResolvedValue({
      id: 2,
      realm_name: "Illidan",
      region: "us",
      enabled: true,
    });

    renderWithProviders(<Realms />, "/realms");
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByRole("combobox", { name: "Realm" }), "Stormrage");
    await user.click(screen.getByRole("button", { name: "Add realm" }));

    expect(await screen.findByText("Realm already tracked.")).toBeInTheDocument();
    expect(createRealm).not.toHaveBeenCalled();
  });

  it("submits add, edit, and delete actions", async () => {
    vi.mocked(getRealms).mockResolvedValue([{ id: 1, realm_name: "Stormrage", region: "us", enabled: true }]);
    vi.mocked(createRealm).mockResolvedValue({
      id: 2,
      realm_name: "Illidan",
      region: "us",
      enabled: true,
    });
    vi.mocked(updateRealm).mockResolvedValue({
      id: 1,
      realm_name: "Stormrage",
      region: "us",
      enabled: false,
    });
    vi.mocked(deleteRealm).mockResolvedValue(undefined);

    renderWithProviders(<Realms />, "/realms");
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByRole("combobox", { name: "Realm" }), "Illidan");
    await user.click(screen.getByRole("button", { name: "Add realm" }));
    expect(vi.mocked(createRealm).mock.calls[0]?.[0]).toEqual({ realm_name: "Illidan", region: "us", enabled: true });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save realm" }));
    expect(vi.mocked(updateRealm).mock.calls[0]?.[0]).toBe(1);
    expect(vi.mocked(updateRealm).mock.calls[0]?.[1]).toEqual({ realm_name: "Stormrage", region: "us", enabled: true });

    await user.click(screen.getByRole("button", { name: "Disable" }));
    expect(vi.mocked(updateRealm).mock.calls[1]?.[0]).toBe(1);
    expect(vi.mocked(updateRealm).mock.calls[1]?.[1]).toEqual({ enabled: false });

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(vi.mocked(deleteRealm).mock.calls[0]?.[0]).toBe(1);
  });

  it("renders failure state when realms cannot be loaded", async () => {
    vi.mocked(getRealms).mockRejectedValue(new Error("boom"));

    renderWithProviders(<Realms />, "/realms");

    expect(await screen.findByText("Tracked realms could not be loaded.")).toBeInTheDocument();
  });
});
