import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function CuentaPage() {
  const session = await requireUser();
  const db = getDb();
  const [user] = await db
    .select({
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      displayName: schema.users.displayName,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.sub))
    .limit(1);
  if (!user) redirect("/login"); // stale session for a deleted account

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h2 className="font-display text-xl font-bold uppercase">Mi cuenta</h2>

      {session.mustChangePassword && (
        <p className="rounded-lg border border-volt-400/40 bg-volt-400/10 px-3 py-2 text-sm text-volt-400">
          Entraste con una contraseña temporal. Elige una nueva para seguir
          jugando (la temporal va como contraseña actual).
        </p>
      )}

      <section className="rounded-xl border border-line bg-pitch-900 p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Nombre</dt>
            <dd className="text-right">
              {user.firstName} {user.lastName}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Apodo</dt>
            <dd className="text-right">{user.displayName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Email</dt>
            <dd className="truncate text-right">{user.email}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-line bg-pitch-900 p-4">
        <h3 className="mb-4 font-display font-bold">Cambiar contraseña</h3>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
