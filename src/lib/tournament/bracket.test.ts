import { describe, expect, it } from "vitest";
import { MATCHES, TEAMS, type GroupLetter } from "../db/seed-data";
import { GROUP_LETTERS, computeGroupStandings, rankThirds } from "./standings";
import { assignThirdSlots, buildBracket, thirdsAssignmentFeasible, winnerOf } from "./bracket";
import type { Score } from "./types";

const THIRD_SLOTS = MATCHES.filter((m) => m.awaySource?.startsWith("3")).map((m) => ({
  matchId: m.id,
  allowed: m.awaySource!.slice(1).split("") as GroupLetter[],
}));

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  return [
    ...combinations(rest, size - 1).map((c) => [head, ...c]),
    ...combinations(rest, size),
  ];
}

/** Full set of group predictions where home always wins `home`-`away`. */
function fullGroupScores(home = 2, away = 0) {
  const scores = new Map<number, Score>();
  for (const m of MATCHES.filter((m) => m.phase === "group")) {
    scores.set(m.id, { home, away });
  }
  return scores;
}

describe("third-place slot assignment", () => {
  it("is feasible for all 495 possible combinations of qualified thirds", () => {
    const combos = combinations(GROUP_LETTERS, 8);
    expect(combos).toHaveLength(495);
    for (const combo of combos) {
      const assignment = assignThirdSlots(combo);
      expect(assignment, `combo ${combo.join("")}`).not.toBeNull();
      const assigned = [...assignment!.values()].sort();
      expect(assigned, `combo ${combo.join("")}`).toEqual([...combo].sort());
      for (const [matchId, group] of assignment!) {
        const slot = THIRD_SLOTS.find((s) => s.matchId === matchId)!;
        expect(slot.allowed, `combo ${combo.join("")} match ${matchId}`).toContain(group);
      }
      expect(
        thirdsAssignmentFeasible(
          THIRD_SLOTS.map((s) => s.allowed),
          combo,
        ),
      ).toBe(true);
    }
  });

  it("is deterministic", () => {
    const combo: GroupLetter[] = ["A", "C", "D", "E", "F", "I", "J", "L"];
    const first = assignThirdSlots(combo);
    const second = assignThirdSlots([...combo].reverse());
    expect([...first!.entries()].sort()).toEqual([...second!.entries()].sort());
  });
});

describe("buildBracket", () => {
  it("leaves all knockout slots null with no scores", () => {
    const bracket = buildBracket(new Map());
    for (const [, slot] of bracket) {
      expect(slot).toEqual({ home: null, away: null });
    }
  });

  it("fills the R32 with winners, runners-up and qualified thirds", () => {
    const scores = fullGroupScores();
    const bracket = buildBracket(scores);

    for (const group of GROUP_LETTERS) {
      const standings = computeGroupStandings(group, scores);
      const winnerSlot = MATCHES.find(
        (m) => m.homeSource === `${group}1` || m.awaySource === `${group}1`,
      )!;
      const slot = bracket.get(winnerSlot.id)!;
      const side = winnerSlot.homeSource === `${group}1` ? "home" : "away";
      expect(slot[side]).toBe(standings[0].code);
    }

    const thirds = rankThirds(scores)!;
    const qualified = new Set(thirds.filter((t) => t.qualified).map((t) => t.code));
    for (const { matchId, allowed } of THIRD_SLOTS) {
      const away = bracket.get(matchId)!.away!;
      expect(qualified.has(away), `match ${matchId}`).toBe(true);
      const team = TEAMS.find((t) => t.code === away)!;
      expect(allowed).toContain(team.group);
    }
  });

  it("propagates winners through to the final, honoring winner_side on draws", () => {
    const scores = fullGroupScores();
    // All knockout matches: home side wins 1-0, except match 90 is a draw
    // decided by penalties for the away side.
    for (const m of MATCHES.filter((m) => m.phase !== "group")) {
      scores.set(m.id, m.id === 90 ? { home: 1, away: 1, winnerSide: "away" } : { home: 1, away: 0 });
    }
    const bracket = buildBracket(scores);

    const slot90 = bracket.get(90)!;
    const slot97 = bracket.get(97)!;
    expect(slot97.away).toBe(slot90.away); // penalties winner advanced

    const final = bracket.get(104)!;
    expect(final.home).not.toBeNull();
    expect(final.away).not.toBeNull();
    expect(winnerOf(104, bracket, scores)).toBe(final.home);
  });

  it("does not advance a knockout draw without winner_side", () => {
    const scores = fullGroupScores();
    scores.set(73, { home: 1, away: 1 }); // no winnerSide
    const bracket = buildBracket(scores);
    expect(bracket.get(73)!.home).not.toBeNull();
    expect(bracket.get(90)!.home).toBeNull(); // W73 unresolved
  });

  it("applies admin overrides to specific slots", () => {
    const scores = fullGroupScores();
    const derived = buildBracket(scores).get(73)!;
    const overrides = new Map([[73, { home: "QAT" }]]);
    const overridden = buildBracket(scores, overrides).get(73)!;
    expect(overridden.home).toBe("QAT");
    expect(overridden.away).toBe(derived.away);
  });
});
