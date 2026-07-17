import { battleWinnerOf } from "./battle/rules";
import { CODE_BY_TEAM_ID, type ScoreRecord } from "./dto";
import type { BracketOverrides, Score, Side } from "./tournament";

// Converters between DB rows and engine/client shapes.

export interface ScoreRow {
  matchId: number;
  homeScore: number;
  awayScore: number;
  winnerSide: "home" | "away" | null;
}

export function rowsToScoreMap(rows: ScoreRow[]): Map<number, Score> {
  return new Map(
    rows.map((r) => [
      r.matchId,
      { home: r.homeScore, away: r.awayScore, winnerSide: r.winnerSide },
    ]),
  );
}

export function scoreMapToRecord(map: ReadonlyMap<number, Score>): ScoreRecord {
  const record: ScoreRecord = {};
  for (const [id, s] of map) {
    record[id] = { home: s.home, away: s.away, winnerSide: s.winnerSide ?? null };
  }
  return record;
}

/** Aggregate every user's clicks per match and keep only battles with a strict winner. */
export function battleRowsToWinners(
  rows: Array<{ matchId: number; homeClicks: number; awayClicks: number }>,
): Map<number, Side> {
  const totals = new Map<number, { home: number; away: number }>();
  for (const r of rows) {
    const t = totals.get(r.matchId) ?? { home: 0, away: 0 };
    t.home += r.homeClicks;
    t.away += r.awayClicks;
    totals.set(r.matchId, t);
  }
  const winners = new Map<number, Side>();
  for (const [matchId, t] of totals) {
    const winner = battleWinnerOf(t);
    if (winner) winners.set(matchId, winner);
  }
  return winners;
}

export function overrideRowsToMap(
  rows: Array<{ matchId: number; homeTeamId: number | null; awayTeamId: number | null }>,
): BracketOverrides {
  return new Map(
    rows.map((r) => [
      r.matchId,
      {
        home: r.homeTeamId ? CODE_BY_TEAM_ID.get(r.homeTeamId) : undefined,
        away: r.awayTeamId ? CODE_BY_TEAM_ID.get(r.awayTeamId) : undefined,
      },
    ]),
  );
}
