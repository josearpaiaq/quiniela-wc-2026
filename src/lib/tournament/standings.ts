import { MATCHES, TEAMS, type GroupLetter, type SeedMatch } from "../db/seed-data";
import type { Score, ScoreMap, StandingRow, ThirdRow } from "./types";

export const GROUP_LETTERS: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const groupMatchesByLetter = new Map<GroupLetter, SeedMatch[]>(
  GROUP_LETTERS.map((letter) => [
    letter,
    MATCHES.filter((m) => m.phase === "group" && m.group === letter),
  ]),
);

const drawPositionByCode = new Map(TEAMS.map((t) => [t.code, t.drawPosition]));

interface Stats {
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
}

function emptyStats(code: string): Stats {
  return { code, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0 };
}

function accumulate(stats: Map<string, Stats>, home: string, away: string, score: Score) {
  const h = stats.get(home)!;
  const a = stats.get(away)!;
  h.played++;
  a.played++;
  h.gf += score.home;
  h.ga += score.away;
  a.gf += score.away;
  a.ga += score.home;
  if (score.home > score.away) {
    h.won++;
    a.lost++;
  } else if (score.home < score.away) {
    a.won++;
    h.lost++;
  } else {
    h.drawn++;
    a.drawn++;
  }
}

const points = (s: Stats) => s.won * 3 + s.drawn;
const gd = (s: Stats) => s.gf - s.ga;

/**
 * Deterministic group ordering (spec §2): points, goal difference, goals
 * scored, then the same three criteria recomputed among the tied teams only
 * (head-to-head), then draw position. No drawing of lots.
 */
export function computeGroupStandings(group: GroupLetter, scores: ScoreMap): StandingRow[] {
  const teams = TEAMS.filter((t) => t.group === group);
  const matches = groupMatchesByLetter.get(group)!;

  const stats = new Map(teams.map((t) => [t.code, emptyStats(t.code)]));
  const scoredMatches = matches.filter((m) => scores.has(m.id));
  for (const m of scoredMatches) {
    accumulate(stats, m.home!, m.away!, scores.get(m.id)!);
  }

  const rows = [...stats.values()];
  rows.sort((a, b) => points(b) - points(a) || gd(b) - gd(a) || b.gf - a.gf);

  // Resolve clusters tied on all three global criteria via head-to-head.
  const ordered: Stats[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (
      j < rows.length &&
      points(rows[j]) === points(rows[i]) &&
      gd(rows[j]) === gd(rows[i]) &&
      rows[j].gf === rows[i].gf
    ) {
      j++;
    }
    const cluster = rows.slice(i, j);
    if (cluster.length > 1) {
      const codes = new Set(cluster.map((s) => s.code));
      const h2h = new Map(cluster.map((s) => [s.code, emptyStats(s.code)]));
      for (const m of scoredMatches) {
        if (codes.has(m.home!) && codes.has(m.away!)) {
          accumulate(h2h, m.home!, m.away!, scores.get(m.id)!);
        }
      }
      cluster.sort((a, b) => {
        const ha = h2h.get(a.code)!;
        const hb = h2h.get(b.code)!;
        return (
          points(hb) - points(ha) ||
          gd(hb) - gd(ha) ||
          hb.gf - ha.gf ||
          drawPositionByCode.get(a.code)! - drawPositionByCode.get(b.code)!
        );
      });
    }
    ordered.push(...cluster);
    i = j;
  }

  return ordered.map((s, index) => ({
    code: s.code,
    group,
    position: index + 1,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    gf: s.gf,
    ga: s.ga,
    gd: gd(s),
    points: points(s),
  }));
}

export function isGroupComplete(group: GroupLetter, scores: ScoreMap): boolean {
  return groupMatchesByLetter.get(group)!.every((m) => scores.has(m.id));
}

export function allGroupsComplete(scores: ScoreMap): boolean {
  return GROUP_LETTERS.every((g) => isGroupComplete(g, scores));
}

/**
 * Ranking of third-placed teams (spec §2): points, GD, GF, then group letter.
 * Only meaningful once all 12 groups are complete; returns null before that.
 */
export function rankThirds(scores: ScoreMap): ThirdRow[] | null {
  if (!allGroupsComplete(scores)) return null;
  const thirds = GROUP_LETTERS.map((g) => computeGroupStandings(g, scores)[2]);
  thirds.sort(
    (a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.group.localeCompare(b.group),
  );
  return thirds.map((row, index) => ({
    code: row.code,
    group: row.group,
    points: row.points,
    gd: row.gd,
    gf: row.gf,
    rank: index + 1,
    qualified: index < 8,
  }));
}
