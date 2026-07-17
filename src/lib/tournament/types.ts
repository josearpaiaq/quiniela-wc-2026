import type { GroupLetter } from "../db/seed-data";

export type Side = "home" | "away";

export interface Score {
  home: number;
  away: number;
  /** Required for knockout draws (penalties); relative to the match slot. */
  winnerSide?: Side | null;
}

/** matchId (1-104) -> score. Works for both predictions and real results. */
export type ScoreMap = ReadonlyMap<number, Score>;

export interface StandingRow {
  code: string;
  group: GroupLetter;
  position: number; // 1-4
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface ThirdRow {
  code: string;
  group: GroupLetter;
  points: number;
  gd: number;
  gf: number;
  rank: number; // 1-12
  qualified: boolean; // best 8
}

/** matchId (73-104) -> resolved team codes (null while undecided). */
export type BracketTeams = ReadonlyMap<number, { home: string | null; away: string | null }>;

/** Per-side manual correction of the real bracket (admin only). */
export type BracketOverrides = ReadonlyMap<
  number,
  { home?: string | null; away?: string | null }
>;

export const ROUND_VALUES = {
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  final: 6,
  champion: 8,
} as const;

export type ScoredRound = keyof typeof ROUND_VALUES;

export interface UserScore {
  total: number;
  groupPoints: number;
  advancePoints: number;
  knockoutExactPoints: number;
  /** +1 per match where the user's predicted winner won both the match and its click battle. */
  battlePoints: number;
  /**
   * matchId -> points for matches with both prediction and result:
   * 0 | 1 | 3 for group matches; 0 | 3 | 6 | 9 for the third-place match
   * (scored like a semifinal: winner 6, exact score +3).
   */
  groupPointsByMatch: ReadonlyMap<number, number>;
  /** round -> { hits: team codes correctly placed, points } */
  advanceByRound: ReadonlyMap<ScoredRound, { hits: string[]; points: number }>;
  /** matchId -> 0 | 3 for knockout matches (r32–final) that have both prediction and result. */
  knockoutExactByMatch: ReadonlyMap<number, number>;
}
