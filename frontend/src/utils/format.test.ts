import { describe, expect, it } from "vitest";
import { formatGold } from "./format";

describe("formatGold", () => {
  it("formats copper values into gold, silver, and copper", () => {
    expect(formatGold(64506400)).toBe("6,450g 64s 0c");
    expect(formatGold(130000)).toBe("13g 0s 0c");
    expect(formatGold(58800)).toBe("5g 88s 0c");
  });

  it("preserves negative values", () => {
    expect(formatGold(-12345)).toBe("-1g 23s 45c");
  });
});
