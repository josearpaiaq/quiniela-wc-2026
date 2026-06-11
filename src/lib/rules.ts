import { z } from "zod";
import type { Phase } from "./db/seed-data";

// Pure business rules shared by server actions and UI. The server is the
// authority: actions re-check these regardless of what the client rendered.

export interface MatchLockInfo {
  kickoffAt: Date;
  openOverride: boolean;
}

/** A prediction is editable until the real kickoff, unless the admin re-opened the match. */
export function isMatchOpen(match: MatchLockInfo, now: Date = new Date()): boolean {
  if (match.openOverride) return true;
  return now.getTime() < match.kickoffAt.getTime();
}

/** Anti-copy rule: others' picks become visible only when the match can no longer be edited. */
export function isPredictionVisibleToOthers(match: MatchLockInfo, now: Date = new Date()): boolean {
  return !isMatchOpen(match, now);
}

export const scoreSchema = z.number().int().min(0).max(99);

export const predictionInputSchema = z.object({
  matchId: z.number().int().min(1).max(104),
  homeScore: scoreSchema,
  awayScore: scoreSchema,
  winnerSide: z.enum(["home", "away"]).nullish(),
});

export type PredictionInput = z.infer<typeof predictionInputSchema>;

/**
 * Knockout draws need a penalties winner; group matches must not carry one.
 * Returns the normalized winnerSide or an error message (Spanish, user-facing).
 */
export function normalizeWinnerSide(
  phase: Phase,
  input: PredictionInput,
): { ok: true; winnerSide: "home" | "away" | null } | { ok: false; error: string } {
  const isDraw = input.homeScore === input.awayScore;
  if (phase === "group") return { ok: true, winnerSide: null };
  if (!isDraw) return { ok: true, winnerSide: null };
  if (!input.winnerSide) {
    return { ok: false, error: "Con empate debes elegir quién avanza en penales" };
  }
  return { ok: true, winnerSide: input.winnerSide };
}
