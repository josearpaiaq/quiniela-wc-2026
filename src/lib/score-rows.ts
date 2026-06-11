import { CODE_BY_TEAM_ID, type ScoreRecord } from "./dto";
import type { BracketOverrides, Score } from "./tournament";

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
