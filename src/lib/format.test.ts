import { describe, expect, it } from "vitest";
import { isSameLocalDay } from "./format";

describe("isSameLocalDay", () => {
  it("matches two times on the same local day", () => {
    expect(
      isSameLocalDay(new Date(2026, 5, 11, 0, 5), new Date(2026, 5, 11, 23, 50)),
    ).toBe(true);
  });

  it("rejects different days, including across midnight", () => {
    expect(isSameLocalDay(new Date(2026, 5, 11, 23, 59), new Date(2026, 5, 12, 0, 1))).toBe(false);
    expect(isSameLocalDay(new Date(2026, 5, 11), new Date(2026, 6, 11))).toBe(false);
    expect(isSameLocalDay(new Date(2026, 5, 11), new Date(2027, 5, 11))).toBe(false);
  });
});
