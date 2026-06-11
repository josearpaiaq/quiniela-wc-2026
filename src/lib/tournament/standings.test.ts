import { describe, expect, it } from "vitest";
import { MATCHES } from "../db/seed-data";
import { computeGroupStandings, isGroupComplete, rankThirds } from "./standings";
import type { Score } from "./types";

// Group A fixture (codes/match ids from seed-data):
//  1: MEX-RSA   2: KOR-CZE   25: CZE-RSA   28: MEX-KOR   53: CZE-MEX   54: RSA-KOR
const scoresOf = (entries: Array<[number, number, number, ("home" | "away")?]>) =>
  new Map<number, Score>(
    entries.map(([id, home, away, winnerSide]) => [id, { home, away, winnerSide }]),
  );

describe("computeGroupStandings", () => {
  it("orders by points, then goal difference, then goals scored", () => {
    const scores = scoresOf([
      [1, 3, 0], // MEX 3-0 RSA
      [2, 1, 1], // KOR 1-1 CZE
      [25, 2, 0], // CZE 2-0 RSA
      [28, 1, 1], // MEX 1-1 KOR
      [53, 0, 1], // CZE 0-1 MEX
      [54, 0, 2], // RSA 0-2 KOR
    ]);
    const rows = computeGroupStandings("A", scores);
    // MEX 7pts; KOR 5pts; CZE 4pts; RSA 0pts
    expect(rows.map((r) => r.code)).toEqual(["MEX", "KOR", "CZE", "RSA"]);
    expect(rows[0]).toMatchObject({ points: 7, gd: 4, position: 1 });
    expect(rows[3]).toMatchObject({ points: 0, played: 3 });
  });

  it("breaks full ties via head-to-head result", () => {
    // MEX and KOR end tied on points (6), GD (+1) and GF (2),
    // but KOR beat MEX in their direct match.
    const scores = scoresOf([
      [1, 1, 0], // MEX 1-0 RSA
      [2, 0, 1], // KOR 0-1 CZE
      [25, 1, 1], // CZE 1-1 RSA
      [28, 0, 1], // MEX 0-1 KOR  <- head-to-head
      [53, 0, 1], // CZE 0-1 MEX
      [54, 0, 1], // RSA 0-1 KOR
    ]);
    const rows = computeGroupStandings("A", scores);
    const mex = rows.find((r) => r.code === "MEX")!;
    const kor = rows.find((r) => r.code === "KOR")!;
    expect(mex.points).toBe(6);
    expect(kor.points).toBe(6);
    expect(mex.gd).toBe(kor.gd);
    expect(mex.gf).toBe(kor.gf);
    expect(kor.position).toBeLessThan(mex.position);
  });

  it("falls back to draw position when head-to-head also ties", () => {
    // All six draws 0-0: everything ties; order must be draw position.
    const scores = scoresOf([
      [1, 0, 0],
      [2, 0, 0],
      [25, 0, 0],
      [28, 0, 0],
      [53, 0, 0],
      [54, 0, 0],
    ]);
    const rows = computeGroupStandings("A", scores);
    expect(rows.map((r) => r.code)).toEqual(["MEX", "RSA", "KOR", "CZE"]);
  });

  it("works with partial scores and reports completeness", () => {
    const scores = scoresOf([[1, 2, 1]]);
    const rows = computeGroupStandings("A", scores);
    expect(rows[0].code).toBe("MEX");
    expect(rows[0].played).toBe(1);
    expect(rows.find((r) => r.code === "KOR")!.played).toBe(0);
    expect(isGroupComplete("A", scores)).toBe(false);
  });
});

describe("rankThirds", () => {
  it("returns null until all 12 groups are complete", () => {
    expect(rankThirds(new Map())).toBeNull();
  });

  it("ranks thirds by points, GD, GF, then group letter, qualifying the best 8", () => {
    // Home always wins 2-0 except one group-A tweak making its third stronger.
    const scores = new Map<number, Score>();
    for (const m of MATCHES.filter((m) => m.phase === "group")) {
      scores.set(m.id, { home: 2, away: 0 });
    }
    const thirds = rankThirds(scores)!;
    expect(thirds).toHaveLength(12);
    expect(thirds.filter((t) => t.qualified)).toHaveLength(8);
    // identical records everywhere -> ranked by group letter
    expect(thirds.map((t) => t.group)).toEqual([
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
    ]);
    expect(thirds[11].qualified).toBe(false);

    // Boost group L's third: it should jump to rank 1.
    // L fixture: 21 GHA-PAN, 22 ENG-CRO, 45 ENG-GHA, 46 PAN-CRO, 67 PAN-ENG, 68 CRO-GHA
    scores.set(21, { home: 9, away: 0 }); // GHA hammers PAN
    const boosted = rankThirds(scores)!;
    expect(boosted[0].group).toBe("L");
    expect(boosted[0].code).toBe("GHA");
  });
});
