import { describe, expect, it } from "vitest";
import { computeChampionIds } from "./champion";

describe("computeChampionIds", () => {
  it("returns only the leader when nobody else matches", () => {
    const ids = computeChampionIds([
      { id: "a", total: 100, exactos: 10 },
      { id: "b", total: 90, exactos: 10 },
      { id: "c", total: 90, exactos: 8 },
    ]);
    expect(ids).toEqual(new Set(["a"]));
  });

  it("treats a tie on total and exactos as a real tie", () => {
    const ids = computeChampionIds([
      { id: "a", total: 100, exactos: 10 },
      { id: "b", total: 100, exactos: 10 },
      { id: "c", total: 90, exactos: 9 },
    ]);
    expect(ids).toEqual(new Set(["a", "b"]));
  });

  it("does not treat a tie on total alone (different exactos) as a real tie", () => {
    const ids = computeChampionIds([
      { id: "a", total: 100, exactos: 10 },
      { id: "b", total: 100, exactos: 8 },
    ]);
    expect(ids).toEqual(new Set(["a"]));
  });

  it("returns an empty set for an empty leaderboard", () => {
    expect(computeChampionIds([])).toEqual(new Set());
  });
});
