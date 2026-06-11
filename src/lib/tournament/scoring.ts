import { MATCHES } from "../db/seed-data";
import { buildBracket, winnerOf } from "./bracket";
import type {
  BracketOverrides,
  BracketTeams,
  ScoreMap,
  ScoredRound,
  UserScore,
} from "./types";
import { ROUND_VALUES } from "./types";

export const GROUP_EXACT_POINTS = 3;
export const GROUP_OUTCOME_POINTS = 1;

const GROUP_MATCHES = MATCHES.filter((m) => m.phase === "group");

const ROUND_MATCH_IDS: Record<Exclude<ScoredRound, "champion">, number[]> = {
  r32: MATCHES.filter((m) => m.phase === "r32").map((m) => m.id),
  r16: MATCHES.filter((m) => m.phase === "r16").map((m) => m.id),
  qf: MATCHES.filter((m) => m.phase === "qf").map((m) => m.id),
  sf: MATCHES.filter((m) => m.phase === "sf").map((m) => m.id),
  final: [104],
};

const outcome = (s: { home: number; away: number }) => Math.sign(s.home - s.away);

function teamsInRound(bracket: BracketTeams, matchIds: number[]): Set<string> {
  const teams = new Set<string>();
  for (const id of matchIds) {
    const slot = bracket.get(id);
    if (slot?.home) teams.add(slot.home);
    if (slot?.away) teams.add(slot.away);
  }
  return teams;
}

/**
 * Full scoring of one user against reality (spec §2):
 * - group matches: exact score 3, correct outcome 1
 * - knockout: advancement points per team correctly placed in each real round
 *   (presence, not slot); the third-place match never scores
 */
export function scoreUser(
  predictions: ScoreMap,
  results: ScoreMap,
  realOverrides?: BracketOverrides,
): UserScore {
  let groupPoints = 0;
  const groupPointsByMatch = new Map<number, number>();
  for (const match of GROUP_MATCHES) {
    const predicted = predictions.get(match.id);
    const real = results.get(match.id);
    if (!predicted || !real) continue;
    let matchPoints = 0;
    if (predicted.home === real.home && predicted.away === real.away) {
      matchPoints = GROUP_EXACT_POINTS;
    } else if (outcome(predicted) === outcome(real)) {
      matchPoints = GROUP_OUTCOME_POINTS;
    }
    groupPointsByMatch.set(match.id, matchPoints);
    groupPoints += matchPoints;
  }

  const userBracket = buildBracket(predictions);
  const realBracket = buildBracket(results, realOverrides);

  let advancePoints = 0;
  const advanceByRound = new Map<ScoredRound, { hits: string[]; points: number }>();
  for (const round of Object.keys(ROUND_MATCH_IDS) as Array<keyof typeof ROUND_MATCH_IDS>) {
    const userTeams = teamsInRound(userBracket, ROUND_MATCH_IDS[round]);
    const realTeams = teamsInRound(realBracket, ROUND_MATCH_IDS[round]);
    const hits = [...userTeams].filter((code) => realTeams.has(code)).sort();
    const points = hits.length * ROUND_VALUES[round];
    advanceByRound.set(round, { hits, points });
    advancePoints += points;
  }

  const userChampion = winnerOf(104, userBracket, predictions);
  const realChampion = winnerOf(104, realBracket, results);
  const championHit = userChampion !== null && userChampion === realChampion;
  advanceByRound.set("champion", {
    hits: championHit ? [userChampion] : [],
    points: championHit ? ROUND_VALUES.champion : 0,
  });
  if (championHit) advancePoints += ROUND_VALUES.champion;

  return {
    total: groupPoints + advancePoints,
    groupPoints,
    advancePoints,
    groupPointsByMatch,
    advanceByRound,
  };
}
