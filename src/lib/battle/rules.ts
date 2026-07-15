import { z } from "zod";

// Pure battle rules shared by the route handlers and the arena client.
// The server is the authority: the POST handler re-checks these regardless
// of what the client rendered.

/** Covers extra time + penalties on knockout matches. */
export const BATTLE_CLOSE_AFTER_KICKOFF_MS = 3 * 60 * 60 * 1000;

/**
 * ~6 clicks/s sustained — above human spam rate, so no human ever hits the
 * cap; console scripts do.
 */
export const MAX_CLICKS_PER_FLUSH = 15;
export const FLUSH_MIN_INTERVAL_MS = 2500;

/** Unsent local clicks beyond this are dropped (console-script guard). */
export const MAX_PENDING_CLICKS = 50;

export interface BattleSlot {
  home: string | null;
  away: string | null;
}

/**
 * A battle opens as soon as both slot teams are known (group: seed data,
 * knockout: bracket derivation) and closes 3h after kickoff.
 */
export function isBattleOpen(
  battle: { kickoffAt: Date; slot: BattleSlot },
  now: Date = new Date(),
): boolean {
  if (!battle.slot.home || !battle.slot.away) return false;
  return now.getTime() < battle.kickoffAt.getTime() + BATTLE_CLOSE_AFTER_KICKOFF_MS;
}

const flushSideSchema = z.number().int().min(0).max(MAX_CLICKS_PER_FLUSH);

export const battleFlushSchema = z
  .object({ home: flushSideSchema, away: flushSideSchema })
  .refine((b) => b.home + b.away >= 1 && b.home + b.away <= MAX_CLICKS_PER_FLUSH, {
    message: `El lote debe tener entre 1 y ${MAX_CLICKS_PER_FLUSH} clicks`,
  });

export type BattleFlush = z.infer<typeof battleFlushSchema>;

export interface SideCounts {
  home: number;
  away: number;
}

/** Split pending clicks into one flushable batch (home first) and the queued rest. */
export function takeFlushBatch(pending: SideCounts): { batch: SideCounts; rest: SideCounts } {
  const home = Math.min(pending.home, MAX_CLICKS_PER_FLUSH);
  const away = Math.min(pending.away, MAX_CLICKS_PER_FLUSH - home);
  return {
    batch: { home, away },
    rest: { home: pending.home - home, away: pending.away - away },
  };
}

export function addPendingClick(pending: SideCounts, side: "home" | "away"): SideCounts {
  if (pending.home + pending.away >= MAX_PENDING_CLICKS) return pending;
  return { ...pending, [side]: pending[side] + 1 };
}
