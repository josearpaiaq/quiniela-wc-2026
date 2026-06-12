"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "../db";
import { clearSessionCookie, createSessionCookie } from "../auth/session";
import { inviteCodeSchema } from "../groups";

export interface AuthFormState {
  error: string | null;
}

const registerSchema = z.object({
  email: z.email("Ingresa un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  firstName: z.string().trim().min(1, "Ingresa tu nombre").max(60),
  lastName: z.string().trim().min(1, "Ingresa tu apellido").max(60),
  displayName: z.string().trim().max(40, "Máximo 40 caracteres").optional(),
  inviteCode: inviteCodeSchema.optional(),
});

const loginSchema = z.object({
  email: z.email("Ingresa un email válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    displayName: formData.get("displayName") || undefined,
    inviteCode: String(formData.get("inviteCode") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { password, firstName, lastName } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();
  const displayName =
    parsed.data.displayName && parsed.data.displayName.length > 0
      ? parsed.data.displayName
      : `${firstName} ${lastName[0]}.`;

  const db = getDb();

  // Resolve the invite code BEFORE creating the user (neon-http has no
  // transactions): a bad code must never leave a half-registered account.
  let groupId: string | null = null;
  if (parsed.data.inviteCode) {
    const [group] = await db
      .select({ id: schema.groups.id })
      .from(schema.groups)
      .where(eq(schema.groups.inviteCode, parsed.data.inviteCode))
      .limit(1);
    if (!group) {
      return { error: "Código de invitación inválido — revísalo o déjalo vacío" };
    }
    groupId = group.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const isAdmin =
    email === (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

  let userId: string;
  try {
    const [user] = await db
      .insert(schema.users)
      .values({ email, passwordHash, firstName, lastName, displayName, isAdmin })
      .returning({ id: schema.users.id });
    userId = user.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes("users_email_unique")) {
      return { error: "Ese email ya está registrado" };
    }
    console.error("register failed", error);
    return { error: "No se pudo crear la cuenta, intenta de nuevo" };
  }

  if (groupId) {
    try {
      await db
        .insert(schema.groupMembers)
        .values({ groupId, userId })
        .onConflictDoNothing();
    } catch (error) {
      // account exists either way; the user can join again from /tabla
      console.error("register: joining group failed", error);
    }
  }

  await createSessionCookie({ sub: userId, name: displayName, admin: isAdmin });
  redirect("/quiniela");
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const email = parsed.data.email.trim().toLowerCase();
  const db = getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  const valid = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!valid) return { error: "Email o contraseña incorrectos" };

  await createSessionCookie({
    sub: user.id,
    name: user.displayName,
    admin: user.isAdmin,
  });
  redirect("/quiniela");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
