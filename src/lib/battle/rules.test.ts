import { describe, expect, it } from "vitest";
import {
  addPendingClick,
  battleFlushSchema,
  isBattleOpen,
  MAX_CLICKS_PER_FLUSH,
  MAX_PENDING_CLICKS,
  takeFlushBatch,
} from "./rules";

const kickoff = new Date("2026-07-19T19:00:00Z");
const slot = { home: "ARG", away: "FRA" };

describe("isBattleOpen", () => {
  it("is closed while either slot team is undefined", () => {
    const before = new Date("2026-07-10T00:00:00Z");
    expect(isBattleOpen({ kickoffAt: kickoff, slot: { home: null, away: "FRA" } }, before)).toBe(false);
    expect(isBattleOpen({ kickoffAt: kickoff, slot: { home: "ARG", away: null } }, before)).toBe(false);
  });

  it("opens as soon as both teams are defined, even days before kickoff", () => {
    expect(isBattleOpen({ kickoffAt: kickoff, slot }, new Date("2026-07-15T00:00:00Z"))).toBe(true);
  });

  it("stays open during the match and closes 3h after kickoff", () => {
    expect(isBattleOpen({ kickoffAt: kickoff, slot }, new Date("2026-07-19T20:30:00Z"))).toBe(true);
    expect(isBattleOpen({ kickoffAt: kickoff, slot }, new Date("2026-07-19T21:59:59Z"))).toBe(true);
    expect(isBattleOpen({ kickoffAt: kickoff, slot }, new Date("2026-07-19T22:00:00Z"))).toBe(false);
  });
});

describe("battleFlushSchema", () => {
  it("accepts 1 to MAX_CLICKS_PER_FLUSH clicks total", () => {
    expect(battleFlushSchema.safeParse({ home: 1, away: 0 }).success).toBe(true);
    expect(battleFlushSchema.safeParse({ home: 0, away: MAX_CLICKS_PER_FLUSH }).success).toBe(true);
    expect(battleFlushSchema.safeParse({ home: 7, away: 8 }).success).toBe(true);
  });

  it("rejects empty, oversized, negative and non-integer batches", () => {
    expect(battleFlushSchema.safeParse({ home: 0, away: 0 }).success).toBe(false);
    expect(battleFlushSchema.safeParse({ home: 8, away: 8 }).success).toBe(false);
    expect(battleFlushSchema.safeParse({ home: 16, away: 0 }).success).toBe(false);
    expect(battleFlushSchema.safeParse({ home: -1, away: 2 }).success).toBe(false);
    expect(battleFlushSchema.safeParse({ home: 1.5, away: 0 }).success).toBe(false);
  });
});

describe("takeFlushBatch", () => {
  it("sends everything when pending fits in one batch", () => {
    expect(takeFlushBatch({ home: 4, away: 2 })).toEqual({
      batch: { home: 4, away: 2 },
      rest: { home: 0, away: 0 },
    });
  });

  it("caps the batch at MAX_CLICKS_PER_FLUSH and queues the rest", () => {
    const { batch, rest } = takeFlushBatch({ home: 20, away: 10 });
    expect(batch.home + batch.away).toBe(MAX_CLICKS_PER_FLUSH);
    expect(batch.home + rest.home).toBe(20);
    expect(batch.away + rest.away).toBe(10);
  });
});

describe("addPendingClick", () => {
  it("increments the clicked side", () => {
    expect(addPendingClick({ home: 1, away: 0 }, "away")).toEqual({ home: 1, away: 1 });
  });

  it("drops clicks beyond MAX_PENDING_CLICKS (console-script guard)", () => {
    const full = { home: MAX_PENDING_CLICKS, away: 0 };
    expect(addPendingClick(full, "home")).toEqual(full);
    expect(addPendingClick(full, "away")).toEqual(full);
  });
});
