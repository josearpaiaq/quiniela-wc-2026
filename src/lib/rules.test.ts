import { describe, expect, it } from "vitest";
import { isMatchOpen, isPredictionVisibleToOthers, normalizeWinnerSide } from "./rules";

const kickoff = new Date("2026-06-20T18:00:00Z");

describe("isMatchOpen", () => {
  it("is open before kickoff and locked after", () => {
    expect(isMatchOpen({ kickoffAt: kickoff, openOverride: false }, new Date("2026-06-20T17:59:59Z"))).toBe(true);
    expect(isMatchOpen({ kickoffAt: kickoff, openOverride: false }, new Date("2026-06-20T18:00:00Z"))).toBe(false);
  });

  it("admin override re-opens a started match", () => {
    expect(isMatchOpen({ kickoffAt: kickoff, openOverride: true }, new Date("2026-07-01T00:00:00Z"))).toBe(true);
  });
});

describe("isPredictionVisibleToOthers", () => {
  it("is the exact negation of editability (anti-copy)", () => {
    const after = new Date("2026-06-20T19:00:00Z");
    expect(isPredictionVisibleToOthers({ kickoffAt: kickoff, openOverride: false }, after)).toBe(true);
    // re-opened by admin -> editable again -> hidden again
    expect(isPredictionVisibleToOthers({ kickoffAt: kickoff, openOverride: true }, after)).toBe(false);
  });
});

describe("normalizeWinnerSide", () => {
  it("group matches never carry a winner side", () => {
    const result = normalizeWinnerSide("group", {
      matchId: 1,
      homeScore: 1,
      awayScore: 1,
      winnerSide: "home",
    });
    expect(result).toEqual({ ok: true, winnerSide: null });
  });

  it("knockout draws require a winner side", () => {
    const missing = normalizeWinnerSide("qf", { matchId: 99, homeScore: 0, awayScore: 0 });
    expect(missing.ok).toBe(false);
    const present = normalizeWinnerSide("qf", {
      matchId: 99,
      homeScore: 0,
      awayScore: 0,
      winnerSide: "away",
    });
    expect(present).toEqual({ ok: true, winnerSide: "away" });
  });

  it("knockout wins drop any stale winner side", () => {
    const result = normalizeWinnerSide("final", {
      matchId: 104,
      homeScore: 2,
      awayScore: 1,
      winnerSide: "away",
    });
    expect(result).toEqual({ ok: true, winnerSide: null });
  });
});
