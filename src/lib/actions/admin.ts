"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../auth/session";
import { getDb, schema } from "../db";
import { normalizeWinnerSide, predictionInputSchema } from "../rules";
import { generateTempPassword } from "../temp-password";
import type { SaveResult } from "./predictions";

export async function saveOfficialResult(input: unknown): Promise<SaveResult> {
  const session = await requireAdmin();

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

  const winner = normalizeWinnerSide(match.phase, parsed.data);
  if (!winner.ok) return { ok: false, error: winner.error };

  await db
    .insert(schema.results)
    .values({
      matchId,
      homeScore,
      awayScore,
      winnerSide: winner.winnerSide,
      enteredBy: session.sub,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.results.matchId,
      set: {
        homeScore,
        awayScore,
        winnerSide: winner.winnerSide,
        enteredBy: session.sub,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}

const toggleSchema = z.object({
  matchId: z.number().int().min(1).max(104),
  open: z.boolean(),
});

export async function setMatchOpenOverride(input: unknown): Promise<SaveResult> {
  await requireAdmin();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Entrada inválida" };

  const db = getDb();
  const updated = await db
    .update(schema.matches)
    .set({ openOverride: parsed.data.open })
    .where(eq(schema.matches.id, parsed.data.matchId))
    .returning({ id: schema.matches.id });
  if (updated.length === 0) return { ok: false, error: "Partido inexistente" };

  return { ok: true };
}

const resetPasswordSchema = z.object({ userId: z.uuid() });

export type ResetPasswordResult =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string };

export async function resetUserPassword(input: unknown): Promise<ResetPasswordResult> {
  const session = await requireAdmin();

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Entrada inválida" };
  if (parsed.data.userId === session.sub) {
    return { ok: false, error: "Cambia tu propia contraseña desde Mi cuenta" };
  }

  // shown once to the admin and never persisted in plaintext
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const db = getDb();
  const updated = await db
    .update(schema.users)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(schema.users.id, parsed.data.userId))
    .returning({ id: schema.users.id });
  if (updated.length === 0) return { ok: false, error: "Usuario inexistente" };

  return { ok: true, tempPassword };
}

const overrideSchema = z.object({
  matchId: z.number().int().min(73).max(104),
  homeTeamId: z.number().int().min(1).max(48).nullable(),
  awayTeamId: z.number().int().min(1).max(48).nullable(),
});

export async function saveKnockoutOverride(input: unknown): Promise<SaveResult> {
  await requireAdmin();
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Entrada inválida" };
  const { matchId, homeTeamId, awayTeamId } = parsed.data;

  const db = getDb();
  if (homeTeamId === null && awayTeamId === null) {
    await db
      .delete(schema.knockoutOverrides)
      .where(eq(schema.knockoutOverrides.matchId, matchId));
  } else {
    await db
      .insert(schema.knockoutOverrides)
      .values({ matchId, homeTeamId, awayTeamId })
      .onConflictDoUpdate({
        target: schema.knockoutOverrides.matchId,
        set: { homeTeamId, awayTeamId },
      });
  }

  return { ok: true };
}
