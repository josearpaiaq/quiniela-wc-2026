import { MATCHES } from "../db/seed-data";
import { buildBracket } from "./bracket";
import type {
  BracketOverrides,
  BracketTeams,
  ScoreMap,
  Side,
  ScoredRound,
  UserScore,
} from "./types";
import { ROUND_VALUES } from "./types";

export const GROUP_EXACT_POINTS = 3;
export const GROUP_OUTCOME_POINTS = 1;
export const KNOCKOUT_EXACT_POINTS = 3;

const GROUP_MATCHES = MATCHES.filter((m) => m.phase === "group");

const ROUND_MATCH_IDS: Record<Exclude<ScoredRound, "champion">, number[]> = {
  r32: MATCHES.filter((m) => m.phase === "r32").map((m) => m.id),
  r16: MATCHES.filter((m) => m.phase === "r16").map((m) => m.id),
  qf: MATCHES.filter((m) => m.phase === "qf").map((m) => m.id),
  sf: MATCHES.filter((m) => m.phase === "sf").map((m) => m.id),
  final: [104],
};

export const ALL_KNOCKOUT_SCORED_MATCH_IDS: readonly number[] = [
  ...ROUND_MATCH_IDS.r32,
  ...ROUND_MATCH_IDS.r16,
  ...ROUND_MATCH_IDS.qf,
  ...ROUND_MATCH_IDS.sf,
  ...ROUND_MATCH_IDS.final,
];

const outcome = (s: { home: number; away: number }) => Math.sign(s.home - s.away);

function pickSide(score: { home: number; away: number; winnerSide?: Side | null }): Side | null {
  if (score.home > score.away) return "home";
  if (score.home < score.away) return "away";
  return score.winnerSide ?? null;
}

/** Points for one match prediction against the real score: exact 3, outcome 1, else 0. */
export function groupMatchPoints(
  predicted: { home: number; away: number },
  real: { home: number; away: number },
): number {
  if (predicted.home === real.home && predicted.away === real.away) return GROUP_EXACT_POINTS;
  if (outcome(predicted) === outcome(real)) return GROUP_OUTCOME_POINTS;
  return 0;
}

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
    const matchPoints = groupMatchPoints(predicted, real);
    groupPointsByMatch.set(match.id, matchPoints);
    groupPoints += matchPoints;
  }

  // r32 advancement still comes from the user's group predictions (who advances from groups)
  const userBracket = buildBracket(predictions);
  const realBracket = buildBracket(results, realOverrides);

  let advancePoints = 0;
  const advanceByRound = new Map<ScoredRound, { hits: string[]; points: number }>();

  {
    const userTeams = teamsInRound(userBracket, ROUND_MATCH_IDS.r32);
    const realTeams = teamsInRound(realBracket, ROUND_MATCH_IDS.r32);
    const hits = [...userTeams].filter((code) => realTeams.has(code)).sort();
    const points = hits.length * ROUND_VALUES.r32;
    advanceByRound.set("r32", { hits, points });
    advancePoints += points;
  }

  // r16+: user predicts real knockout matches, so advancement is derived from
  // the user's predicted score applied to the real bracket's team codes
  const prevRoundIds: Record<"r16" | "qf" | "sf" | "final", number[]> = {
    r16: ROUND_MATCH_IDS.r32,
    qf: ROUND_MATCH_IDS.r16,
    sf: ROUND_MATCH_IDS.qf,
    final: ROUND_MATCH_IDS.sf,
  };

  for (const round of ["r16", "qf", "sf", "final"] as const) {
    const userTeams = new Set<string>();
    for (const matchId of prevRoundIds[round]) {
      const slot = realBracket.get(matchId);
      if (!slot?.home || !slot.away) continue;
      const score = predictions.get(matchId);
      if (!score) continue;
      const side = pickSide(score);
      if (!side) continue;
      userTeams.add(side === "home" ? slot.home : slot.away);
    }
    const realTeams = teamsInRound(realBracket, ROUND_MATCH_IDS[round]);
    const hits = [...userTeams].filter((code) => realTeams.has(code)).sort();
    const points = hits.length * ROUND_VALUES[round];
    advanceByRound.set(round, { hits, points });
    advancePoints += points;
  }

  const finalSlot = realBracket.get(104);
  const finalPrediction = predictions.get(104);
  let userChampion: string | null = null;
  if (finalSlot?.home && finalSlot.away && finalPrediction) {
    const side = pickSide(finalPrediction);
    if (side) userChampion = side === "home" ? finalSlot.home : finalSlot.away;
  }
  const realChampion = (() => {
    const slot = realBracket.get(104);
    const score = results.get(104);
    if (!slot?.home || !slot.away || !score) return null;
    const side = pickSide(score);
    return side ? (side === "home" ? slot.home : slot.away) : null;
  })();
  const championHit = userChampion !== null && userChampion === realChampion;
  advanceByRound.set("champion", {
    hits: championHit ? [userChampion!] : [],
    points: championHit ? ROUND_VALUES.champion : 0,
  });
  if (championHit) advancePoints += ROUND_VALUES.champion;

  let knockoutExactPoints = 0;
  const knockoutExactByMatch = new Map<number, number>();
  for (const id of ALL_KNOCKOUT_SCORED_MATCH_IDS) {
    const predicted = predictions.get(id);
    const real = results.get(id);
    if (!predicted || !real) continue;
    const pts =
      predicted.home === real.home && predicted.away === real.away ? KNOCKOUT_EXACT_POINTS : 0;
    knockoutExactByMatch.set(id, pts);
    knockoutExactPoints += pts;
  }

  return {
    total: groupPoints + advancePoints + knockoutExactPoints,
    groupPoints,
    advancePoints,
    knockoutExactPoints,
    groupPointsByMatch,
    advanceByRound,
    knockoutExactByMatch,
  };
}

const NEXT_ROUND_VALUE: Record<"r32" | "r16" | "qf" | "sf" | "final", number> = {
  r32: ROUND_VALUES.r16,
  r16: ROUND_VALUES.qf,
  qf: ROUND_VALUES.sf,
  sf: ROUND_VALUES.final,
  final: ROUND_VALUES.champion,
};

/** Points for one knockout match prediction: advance points + exact score bonus. */
export function knockoutMatchPoints(
  phase: "r32" | "r16" | "qf" | "sf" | "final",
  predicted: { home: number; away: number; winnerSide?: Side | null },
  real: { home: number; away: number; winnerSide?: Side | null },
): number {
  const realSide = pickSide(real);
  const advance =
    realSide !== null && pickSide(predicted) === realSide ? NEXT_ROUND_VALUE[phase] : 0;
  const exact =
    predicted.home === real.home && predicted.away === real.away ? KNOCKOUT_EXACT_POINTS : 0;
  return advance + exact;
}
