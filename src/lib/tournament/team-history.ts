import { MATCHES, type Phase } from "../db/seed-data";
import { buildBracket, KNOCKOUT_MATCHES } from "./bracket";
import { groupMatchPoints, knockoutMatchPoints, thirdPlaceMatchPoints } from "./scoring";
import type { BracketOverrides, ScoreMap, Side } from "./types";

const GROUP_MATCHES = MATCHES.filter((m) => m.phase === "group");

export interface TeamHistoryEntry {
  matchId: number;
  phase: Phase;
  opponentCode: string;
  teamScore: number;
  opponentScore: number;
  predictedTeamScore: number | null;
  predictedOpponentScore: number | null;
  points: number | null;
  /** Match's actual home/away codes and penalty winner, for PenaltyBadge. */
  homeCode: string;
  awayCode: string;
  winnerSide: Side | null;
}

function matchPoints(
  phase: Phase,
  predicted: { home: number; away: number; winnerSide?: Side | null },
  real: { home: number; away: number; winnerSide?: Side | null },
): number {
  if (phase === "group") return groupMatchPoints(predicted, real);
  if (phase === "third") return thirdPlaceMatchPoints(predicted, real);
  return knockoutMatchPoints(phase, predicted, real);
}

/**
 * Already-played matches for every team, keyed by team code and sorted
 * chronologically. Only matches with a real result are included.
 */
export function buildTeamHistories(
  predictions: ScoreMap,
  results: ScoreMap,
  overrides?: BracketOverrides,
): ReadonlyMap<string, TeamHistoryEntry[]> {
  const realBracket = buildBracket(results, overrides);
  const histories = new Map<string, TeamHistoryEntry[]>();

  const addEntry = (matchId: number, phase: Phase, homeCode: string, awayCode: string) => {
    const real = results.get(matchId);
    if (!real) return;
    const predicted = predictions.get(matchId);
    const points = predicted ? matchPoints(phase, predicted, real) : null;

    for (const [teamCode, opponentCode, isHome] of [
      [homeCode, awayCode, true],
      [awayCode, homeCode, false],
    ] as const) {
      if (!histories.has(teamCode)) histories.set(teamCode, []);
      histories.get(teamCode)!.push({
        matchId,
        phase,
        opponentCode,
        teamScore: isHome ? real.home : real.away,
        opponentScore: isHome ? real.away : real.home,
        predictedTeamScore: predicted ? (isHome ? predicted.home : predicted.away) : null,
        predictedOpponentScore: predicted ? (isHome ? predicted.away : predicted.home) : null,
        points,
        homeCode,
        awayCode,
        winnerSide: real.winnerSide ?? null,
      });
    }
  };

  for (const m of GROUP_MATCHES) {
    if (m.home && m.away) addEntry(m.id, m.phase, m.home, m.away);
  }
  for (const m of KNOCKOUT_MATCHES) {
    const slot = realBracket.get(m.id);
    if (slot?.home && slot.away) addEntry(m.id, m.phase, slot.home, slot.away);
  }

  for (const entries of histories.values()) {
    entries.sort((a, b) => a.matchId - b.matchId);
  }
  return histories;
}
