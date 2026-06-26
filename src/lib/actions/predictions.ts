"use server";

import { eq } from "drizzle-orm";
import { requireUser } from "../auth/session";
import { getDb, schema } from "../db";
import { isMatchOpen, normalizeWinnerSide, predictionInputSchema } from "../rules";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function savePrediction(input: unknown): Promise<SaveResult> {
  const session = await requireUser(); // userId comes ONLY from the verified JWT

  const parsed = predictionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Marcador inválido" };
  const { matchId, homeScore, awayScore } = parsed.data;

  const db = getDb();
  const [match] = await db
    .select()
    .from(schema.matches)
    .where(eq(schema.matches.id, matchId))
    .limit(1);
  if (!match) return { ok: false, error: "Partido inexistente" };

  if (!isMatchOpen(match)) {
    return { ok: false, error: "Este partido ya está bloqueado" };
  }

  const winner = normalizeWinnerSide(match.phase, parsed.data);
  if (!winner.ok) return { ok: false, error: winner.error };

  await db
    .insert(schema.predictions)
    .values({
      userId: session.sub,
      matchId,
      homeScore,
      awayScore,
      winnerSide: winner.winnerSide,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.predictions.userId, schema.predictions.matchId],
      set: {
        homeScore,
        awayScore,
        winnerSide: winner.winnerSide,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}
