import { describe, expect, it } from "vitest";
import { MATCHES } from "../db/seed-data";
import {
  ALL_KNOCKOUT_SCORED_MATCH_IDS,
  groupMatchPoints,
  knockoutMatchPoints,
  scoreUser,
} from "./scoring";
import type { Score } from "./types";

/** Deterministic full tournament: home wins every match (varied scores). */
function fullTournament(): Map<number, Score> {
  const scores = new Map<number, Score>();
  for (const m of MATCHES) {
    scores.set(m.id, { home: 2 + (m.id % 2), away: m.id % 2 });
  }
  return scores;
}

describe("groupMatchPoints", () => {
  it("scores exact 3, outcome 1, miss 0", () => {
    expect(groupMatchPoints({ home: 2, away: 0 }, { home: 2, away: 0 })).toBe(3);
    expect(groupMatchPoints({ home: 1, away: 0 }, { home: 3, away: 1 })).toBe(1);
    expect(groupMatchPoints({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(1);
    expect(groupMatchPoints({ home: 0, away: 2 }, { home: 1, away: 0 })).toBe(0);
  });
});

describe("scoreUser — group stage", () => {
  it("scores exact 3, outcome 1, miss 0", () => {
    const predictions = new Map<number, Score>([
      [1, { home: 2, away: 0 }], // exact
      [2, { home: 1, away: 0 }], // right outcome, wrong score
      [3, { home: 0, away: 2 }], // wrong outcome
    ]);
    const results = new Map<number, Score>([
      [1, { home: 2, away: 0 }],
      [2, { home: 3, away: 1 }],
      [3, { home: 1, away: 0 }],
    ]);
    const score = scoreUser(predictions, results);
    expect(score.groupPointsByMatch.get(1)).toBe(3);
    expect(score.groupPointsByMatch.get(2)).toBe(1);
    expect(score.groupPointsByMatch.get(3)).toBe(0);
    expect(score.groupPoints).toBe(4);
    expect(score.advancePoints).toBe(0); // nothing resolvable yet
    expect(score.total).toBe(4);
  });

  it("ignores matches without prediction or without result", () => {
    const onlyPrediction = scoreUser(
      new Map([[1, { home: 1, away: 0 }]]),
      new Map(),
    );
    expect(onlyPrediction.total).toBe(0);
    const onlyResult = scoreUser(new Map(), new Map([[1, { home: 1, away: 0 }]]));
    expect(onlyResult.total).toBe(0);
  });
});

describe("knockoutMatchPoints", () => {
  it("pays the standard +3 exact bonus outside the final", () => {
    // advance points for the *next* round: r32→r16(2), r16→qf(3), qf→sf(4), sf→final(6)
    const nextRoundAdvance = { r32: 2, r16: 3, qf: 4, sf: 6 } as const;
    for (const phase of ["r32", "r16", "qf", "sf"] as const) {
      const pts = knockoutMatchPoints(
        phase,
        { home: 2, away: 1, winnerSide: null },
        { home: 2, away: 1, winnerSide: null },
      );
      expect(pts).toBe(nextRoundAdvance[phase] + 3);
    }
  });

  it("pays +10 for an exact final score instead of the usual +3", () => {
    const exactPts = knockoutMatchPoints(
      "final",
      { home: 2, away: 1, winnerSide: null },
      { home: 2, away: 1, winnerSide: null },
    );
    const missedScorePts = knockoutMatchPoints(
      "final",
      { home: 1, away: 1, winnerSide: "home" },
      { home: 2, away: 1, winnerSide: null },
    );
    // exact match adds 10 (bonus) on top of the champion advance points (8)
    expect(exactPts).toBe(18);
    // right winner, wrong score: only the advance points, no exact bonus
    expect(missedScorePts).toBe(8);
  });
});

describe("scoreUser — advancement", () => {
  it("a perfect prediction earns the theoretical maximum of 443", () => {
    const tournament = fullTournament();
    const score = scoreUser(tournament, tournament);
    // 72 group matches + 1 third-place match, all exact
    expect(score.groupPoints).toBe(72 * 3 + 3);
    // 32×1 + 16×2 + 8×3 + 4×4 + 2×6 + champion 8 = 124
    expect(score.advancePoints).toBe(124);
    // every knockout match exact except the final, which pays 10 instead of 3
    const knockoutExactMax = (ALL_KNOCKOUT_SCORED_MATCH_IDS.length - 1) * 3 + 10;
    expect(score.knockoutExactPoints).toBe(knockoutExactMax);
    expect(score.total).toBe(343 + knockoutExactMax);
    expect(score.advanceByRound.get("champion")!.points).toBe(8);
  });

  it("accrues partial advancement points as real groups complete", () => {
    const predictions = fullTournament();
    // Reality: only group A finished (same outcomes as the prediction).
    const results = new Map<number, Score>();
    for (const m of MATCHES.filter((m) => m.phase === "group" && m.group === "A")) {
      results.set(m.id, predictions.get(m.id)!);
    }
    const score = scoreUser(predictions, results);
    // A1 and A2 resolved in the real R32 and matching the prediction: 2 × 1pt.
    // Thirds need all 12 groups, so nothing else resolves.
    expect(score.advanceByRound.get("r32")!.points).toBe(2);
    expect(score.advancePoints).toBe(2);
  });

  it("pays advancement by presence in the round even in a different slot", () => {
    const predictions = fullTournament();
    const results = fullTournament();
    // Reality: swap outcomes of group A so A1/A2 swap (away dominates).
    for (const m of MATCHES.filter((m) => m.phase === "group" && m.group === "A")) {
      const p = predictions.get(m.id)!;
      results.set(m.id, { home: p.away, away: p.home });
    }
    const score = scoreUser(predictions, results);
    const r32 = score.advanceByRound.get("r32")!;
    // The user's predicted A1 is reality's A2 and vice versa: both are still
    // in the real R32 (different slots), and the real third of A changed.
    expect(r32.points).toBeGreaterThanOrEqual(30);
  });

  it("no champion bonus when the champion differs", () => {
    const predictions = fullTournament();
    const results = fullTournament();
    results.set(104, { home: 0, away: 1 }); // away wins the real final instead
    const score = scoreUser(predictions, results);
    expect(score.advanceByRound.get("champion")!.points).toBe(0);
    expect(score.advanceByRound.get("final")!.points).toBe(12); // both finalists still right
  });
});
