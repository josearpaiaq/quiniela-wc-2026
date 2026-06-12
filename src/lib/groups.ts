import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "./db";

// Pure invite-code helpers (shared by actions, registration and pages).

// No ambiguous characters (0/O, 1/I/L) — codes get shared by voice and chat.
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export const inviteCodeSchema = z
  .string()
  .transform(normalizeInviteCode)
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "Código de invitación inválido"));

export interface UserGroup {
  id: string;
  name: string;
  inviteCode: string;
}

export async function getUserGroups(userId: string): Promise<UserGroup[]> {
  const db = getDb();
  return db
    .select({
      id: schema.groups.id,
      name: schema.groups.name,
      inviteCode: schema.groups.inviteCode,
    })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groupMembers.groupId, schema.groups.id))
    .where(eq(schema.groupMembers.userId, userId))
    .orderBy(asc(schema.groupMembers.joinedAt));
}
