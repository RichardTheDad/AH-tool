import { describe, expect, it } from "vitest";
import { formatGold, formatMarketPerDay, formatMarketPercent } from "./format";

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

describe("TSM market formatting", () => {
  it("shows additional precision for tiny sale rates", () => {
    expect(formatMarketPercent(0.042)).toBe("4.2%");
    expect(formatMarketPercent(0.00004)).toBe("0.004%");
    expect(formatMarketPercent(0.0000005)).toBe("<0.001%");
  });

  it("shows tiny sold-per-day values without rounding them to zero", () => {
    expect(formatMarketPerDay(0.315)).toBe("0.315");
    expect(formatMarketPerDay(0.0004)).toBe("<0.001");
  });
});
