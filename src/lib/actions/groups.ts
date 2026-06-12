"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "../auth/session";
import { getDb, schema } from "../db";
import { generateInviteCode, inviteCodeSchema } from "../groups";
import type { SaveResult } from "./predictions";

export interface GroupFormState {
  error: string | null;
  success?: string | null;
}

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre al grupo").max(60, "Máximo 60 caracteres"),
});

export async function createGroup(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await requireAdmin();

  const parsed = createGroupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const db = getDb();
  // unique constraint is the authority on collisions; retry with a fresh code
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.insert(schema.groups).values({
        name: parsed.data.name,
        inviteCode: generateInviteCode(),
        createdBy: session.sub,
      });
      revalidatePath("/admin/grupos");
      revalidatePath("/tabla");
      return { error: null, success: `Grupo "${parsed.data.name}" creado` };
    } catch (error) {
      if (error instanceof Error && error.message.includes("groups_invite_code_unique")) {
        continue;
      }
      console.error("createGroup failed", error);
      return { error: "No se pudo crear el grupo, intenta de nuevo" };
    }
  }
  return { error: "No se pudo generar un código único, intenta de nuevo" };
}

export async function joinGroupByCode(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await requireUser();

  const parsed = inviteCodeSchema.safeParse(formData.get("inviteCode"));
  if (!parsed.success) return { error: "Código de invitación inválido" };

  const db = getDb();
  const [group] = await db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(eq(schema.groups.inviteCode, parsed.data))
    .limit(1);
  if (!group) return { error: "Código de invitación inválido" };

  const inserted = await db
    .insert(schema.groupMembers)
    .values({ groupId: group.id, userId: session.sub })
    .onConflictDoNothing()
    .returning({ groupId: schema.groupMembers.groupId });
  if (inserted.length === 0) return { error: "Ya eres parte de ese grupo" };

  revalidatePath("/tabla");
  revalidatePath("/admin/grupos");
  redirect(`/tabla?grupo=${group.id}`);
}

const addMembersSchema = z.object({
  groupId: z.uuid(),
  userIds: z.array(z.uuid()).min(1).max(200),
});

export async function addGroupMembers(input: unknown): Promise<SaveResult> {
  await requireAdmin();
  const parsed = addMembersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Entrada inválida" };
  const { groupId, userIds } = parsed.data;

  const db = getDb();
  try {
    const inserted = await db
      .insert(schema.groupMembers)
      .values(userIds.map((userId) => ({ groupId, userId })))
      .onConflictDoNothing()
      .returning({ groupId: schema.groupMembers.groupId });
    if (inserted.length === 0) return { ok: false, error: "Ya son parte del grupo" };
  } catch (error) {
    // FK violation: group or some user no longer exists
    console.error("addGroupMembers failed", error);
    return { ok: false, error: "Grupo o usuario inexistente" };
  }

  revalidatePath("/admin/grupos");
  revalidatePath("/tabla");
  return { ok: true };
}

const memberInputSchema = z.object({
  groupId: z.uuid(),
  userId: z.uuid(),
});

export async function removeGroupMember(input: unknown): Promise<SaveResult> {
  await requireAdmin();
  const parsed = memberInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Entrada inválida" };
  const { groupId, userId } = parsed.data;

  const db = getDb();
  const deleted = await db
    .delete(schema.groupMembers)
    .where(
      and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)),
    )
    .returning({ groupId: schema.groupMembers.groupId });
  if (deleted.length === 0) return { ok: false, error: "No es parte del grupo" };

  revalidatePath("/admin/grupos");
  revalidatePath("/tabla");
  return { ok: true };
}
