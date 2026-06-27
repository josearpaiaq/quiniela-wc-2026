import { MATCHES, TEAMS, type GroupLetter, type Phase, type SeedTeam } from "./db/seed-data";
import type { Score, Side } from "./tournament";

// Lean serializable shapes shared between server components and client code.

export interface MatchDTO {
  id: number;
  phase: Phase;
  group: GroupLetter | null;
  kickoffAt: string; // ISO
  venue: string;
  home: string | null; // team code (group matches)
  away: string | null;
  openOverride: boolean;
}

export interface ScoreDTO {
  home: number;
  away: number;
  winnerSide: Side | null;
}

export type ScoreRecord = Record<number, ScoreDTO>;

export const TEAM_BY_CODE: ReadonlyMap<string, SeedTeam> = new Map(
  TEAMS.map((team) => [team.code, team]),
);

/** Seed convention: team id in the DB is its 1-based index in TEAMS. */
export const CODE_BY_TEAM_ID: ReadonlyMap<number, string> = new Map(
  TEAMS.map((team, index) => [index + 1, team.code]),
);

export const TEAM_ID_BY_CODE: ReadonlyMap<string, number> = new Map(
  TEAMS.map((team, index) => [team.code, index + 1]),
);

export const PHASES: Array<{ key: Phase | "finals"; label: string; short: string }> = [
  { key: "group", label: "Fase de grupos", short: "Grupos" },
  { key: "r32", label: "Dieciseisavos de final", short: "16avos" },
  { key: "r16", label: "Octavos de final", short: "Octavos" },
  { key: "qf", label: "Cuartos de final", short: "Cuartos" },
  { key: "sf", label: "Semifinales", short: "Semis" },
  { key: "finals", label: "Final y 3er puesto", short: "Final" },
];

/** The "finals" tab groups the third-place match and the final. */
export function matchesForPhaseTab(key: Phase | "finals"): MatchDTO[] {
  const fromSeed = MATCHES.filter((m) =>
    key === "finals" ? m.phase === "third" || m.phase === "final" : m.phase === key,
  );
  return fromSeed.map((m) => ({
    id: m.id,
    phase: m.phase,
    group: m.group ?? null,
    kickoffAt: m.kickoffAt,
    venue: m.venue,
    home: m.home ?? null,
    away: m.away ?? null,
    openOverride: false,
  }));
}

export function toScoreMap(record: ScoreRecord): Map<number, Score> {
  return new Map(
    Object.entries(record).map(([id, s]) => [
      Number(id),
      { home: s.home, away: s.away, winnerSide: s.winnerSide },
    ]),
  );
}
