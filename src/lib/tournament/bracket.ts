import { MATCHES, type GroupLetter } from "../db/seed-data";
import {
  computeGroupStandings,
  isGroupComplete,
  rankThirds,
} from "./standings";
import type { BracketOverrides, BracketTeams, ScoreMap, Side } from "./types";

export const KNOCKOUT_MATCHES = MATCHES.filter((m) => m.phase !== "group");

const THIRD_SLOT_MATCHES = MATCHES.filter(
  (m) => m.homeSource?.startsWith("3") || m.awaySource?.startsWith("3"),
);

function allowedGroups(source: string): GroupLetter[] {
  return source.slice(1).split("") as GroupLetter[];
}

/** Kuhn's augmenting-path bipartite matching: slot index -> letter index. */
function maxMatchingSize(adjacency: number[][], letterCount: number): number {
  const matchedLetter = Array<number>(letterCount).fill(-1);
  let size = 0;
  for (let slot = 0; slot < adjacency.length; slot++) {
    const visited = Array<boolean>(letterCount).fill(false);
    if (tryAssign(slot, adjacency, visited, matchedLetter)) size++;
  }
  return size;
}

function tryAssign(
  slot: number,
  adjacency: number[][],
  visited: boolean[],
  matchedLetter: number[],
): boolean {
  for (const letter of adjacency[slot]) {
    if (visited[letter]) continue;
    visited[letter] = true;
    if (
      matchedLetter[letter] === -1 ||
      tryAssign(matchedLetter[letter], adjacency, visited, matchedLetter)
    ) {
      matchedLetter[letter] = slot;
      return true;
    }
  }
  return false;
}

export function thirdsAssignmentFeasible(
  slotAllowed: GroupLetter[][],
  qualified: GroupLetter[],
): boolean {
  const index = new Map(qualified.map((g, i) => [g, i]));
  const adjacency = slotAllowed.map((allowed) =>
    allowed.filter((g) => index.has(g)).map((g) => index.get(g)!),
  );
  return maxMatchingSize(adjacency, qualified.length) === slotAllowed.length;
}

/**
 * Deterministic assignment of the 8 qualified thirds to the 8 constrained R32
 * slots: slots in match-number order, each takes the alphabetically-first
 * candidate that keeps the remaining slots assignable. FIFA's Annex C table
 * (495 rows) is not reproducible from public sources; this is the documented
 * deterministic approximation (spec §6) — knockout_overrides corrects the
 * real bracket if FIFA's published assignment ever differs.
 */
export function assignThirdSlots(
  qualifiedGroups: GroupLetter[],
): Map<number, GroupLetter> | null {
  const slots = THIRD_SLOT_MATCHES.map((m) => ({
    matchId: m.id,
    allowed: allowedGroups((m.homeSource?.startsWith("3") ? m.homeSource : m.awaySource)!),
  }));

  const remainingSlots = [...slots];
  const remainingGroups = new Set(qualifiedGroups);
  const assignment = new Map<number, GroupLetter>();

  while (remainingSlots.length > 0) {
    const slot = remainingSlots.shift()!;
    const candidates = slot.allowed.filter((g) => remainingGroups.has(g)).sort();
    let chosen: GroupLetter | null = null;
    for (const candidate of candidates) {
      const groupsLeft = [...remainingGroups].filter((g) => g !== candidate);
      const feasible = thirdsAssignmentFeasible(
        remainingSlots.map((s) => s.allowed),
        groupsLeft,
      );
      if (feasible) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) return null; // no valid assignment exists for this combination
    assignment.set(slot.matchId, chosen);
    remainingGroups.delete(chosen);
  }
  return assignment;
}

function winningSide(score: { home: number; away: number; winnerSide?: Side | null }): Side | null {
  if (score.home > score.away) return "home";
  if (score.home < score.away) return "away";
  return score.winnerSide ?? null;
}

/**
 * Resolves team codes for every knockout match (73-104) from a score map.
 * Used identically for a user's predicted universe and for the real one.
 * Unresolvable slots are null (group stage incomplete, missing picks, or a
 * knockout draw without winner_side).
 */
export function buildBracket(scores: ScoreMap, overrides?: BracketOverrides): BracketTeams {
  const standingsCache = new Map<GroupLetter, ReturnType<typeof computeGroupStandings>>();
  const standingsOf = (group: GroupLetter) => {
    if (!standingsCache.has(group)) {
      standingsCache.set(group, computeGroupStandings(group, scores));
    }
    return standingsCache.get(group)!;
  };

  const thirds = rankThirds(scores);
  const thirdAssignment = thirds
    ? assignThirdSlots(thirds.filter((t) => t.qualified).map((t) => t.group))
    : null;
  const thirdCodeByGroup = new Map(thirds?.map((t) => [t.group, t.code]) ?? []);

  const teams = new Map<number, { home: string | null; away: string | null }>();

  const resolveSource = (source: string, matchId: number): string | null => {
    if (/^[A-L][12]$/.test(source)) {
      const group = source[0] as GroupLetter;
      if (!isGroupComplete(group, scores)) return null;
      return standingsOf(group)[Number(source[1]) - 1].code;
    }
    if (source.startsWith("3")) {
      const group = thirdAssignment?.get(matchId);
      return group ? (thirdCodeByGroup.get(group) ?? null) : null;
    }
    const ref = Number(source.slice(1));
    const refTeams = teams.get(ref);
    if (!refTeams?.home || !refTeams.away) return null;
    const score = scores.get(ref);
    if (!score) return null;
    const side = winningSide(score);
    if (!side) return null;
    const winner = side === "home" ? refTeams.home : refTeams.away;
    const loser = side === "home" ? refTeams.away : refTeams.home;
    return source.startsWith("W") ? winner : loser;
  };

  for (const match of KNOCKOUT_MATCHES) {
    const override = overrides?.get(match.id);
    const home = override?.home !== undefined && override.home !== null
      ? override.home
      : resolveSource(match.homeSource!, match.id);
    const away = override?.away !== undefined && override.away !== null
      ? override.away
      : resolveSource(match.awaySource!, match.id);
    teams.set(match.id, { home, away });
  }
  return teams;
}

/** Winner code of a resolved knockout match, or null while undecided. */
export function winnerOf(
  matchId: number,
  bracket: BracketTeams,
  scores: ScoreMap,
): string | null {
  const slot = bracket.get(matchId);
  if (!slot?.home || !slot.away) return null;
  const score = scores.get(matchId);
  if (!score) return null;
  const side = winningSide(score);
  if (!side) return null;
  return side === "home" ? slot.home : slot.away;
}
