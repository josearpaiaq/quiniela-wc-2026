import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { AdminTabs } from "../admin-tabs";
import { ResetPasswordButton } from "./reset-password-button";

async function AdminUsuariosContent() {
  const session = await requireAdmin();
  const db = getDb();

  const users = await db
    .select({
      id: schema.users.id,
      displayName: schema.users.displayName,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      email: schema.users.email,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.displayName));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold uppercase">Usuarios</h2>
        <AdminTabs active="/admin/usuarios" />
      </header>

      <p className="text-sm text-ink-500">
        Si alguien olvidó su contraseña, resétala aquí y pásale la temporal: la
        verás una sola vez y al entrar tendrá que elegir una nueva.
      </p>

      <ul className="space-y-2">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-pitch-900 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {user.displayName}
                <span className="ml-2 text-xs text-ink-500">
                  {user.firstName} {user.lastName}
                </span>
              </p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
            </div>
            {user.id === session.sub ? (
              <span className="text-xs text-ink-500">Tú — usa Mi cuenta</span>
            ) : (
              <ResetPasswordButton userId={user.id} userName={user.displayName} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminUsuariosPage() {
  return (
    <Suspense fallback={null}>
      <AdminUsuariosContent />
    </Suspense>
  );
}
