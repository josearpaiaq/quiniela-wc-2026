import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { AdminTabs } from "../admin-tabs";
import { CopyCodeButton, CreateGroupForm } from "./create-group-form";
import { GroupMembers, type MemberOption } from "./group-members";

interface GroupCard {
  id: string;
  name: string;
  inviteCode: string;
  members: MemberOption[];
}

async function AdminGruposContent() {
  await requireAdmin();
  const db = getDb();

  const [rows, allUsers] = await Promise.all([
    db
      .select({
        id: schema.groups.id,
        name: schema.groups.name,
        inviteCode: schema.groups.inviteCode,
        memberId: schema.users.id,
        memberName: schema.users.displayName,
      })
      .from(schema.groups)
      .leftJoin(schema.groupMembers, eq(schema.groupMembers.groupId, schema.groups.id))
      .leftJoin(schema.users, eq(schema.groupMembers.userId, schema.users.id))
      .orderBy(asc(schema.groups.createdAt)),
    db
      .select({ id: schema.users.id, name: schema.users.displayName })
      .from(schema.users)
      .orderBy(asc(schema.users.displayName)),
  ]);

  const cards = new Map<string, GroupCard>();
  for (const row of rows) {
    if (!cards.has(row.id)) {
      cards.set(row.id, { id: row.id, name: row.name, inviteCode: row.inviteCode, members: [] });
    }
    if (row.memberId && row.memberName) {
      cards.get(row.id)!.members.push({ id: row.memberId, name: row.memberName });
    }
  }
  const groups = [...cards.values()];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold uppercase">Grupos</h2>
        <AdminTabs active="/admin/grupos" />
      </header>

      <CreateGroupForm />

      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-bright px-4 py-8 text-center text-sm text-ink-500">
          Aún no hay grupos. Crea el primero y comparte su código.
        </p>
      )}

      <div className="space-y-3">
        {groups.map((group) => (
          <section
            key={group.id}
            className="space-y-3 rounded-xl border border-line bg-pitch-900 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold">{group.name}</h3>
                <p className="text-[11px] text-ink-500">
                  {group.members.length}{" "}
                  {group.members.length === 1 ? "participante" : "participantes"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-volt-400/40 bg-volt-400/10 px-3 py-1.5 font-mono text-sm font-bold tracking-[0.2em] text-volt-400">
                  {group.inviteCode}
                </span>
                <CopyCodeButton code={group.inviteCode} />
              </div>
            </div>
            <GroupMembers
              groupId={group.id}
              members={group.members}
              nonMembers={allUsers.filter(
                (user) => !group.members.some((member) => member.id === user.id),
              )}
            />
            <Link
              href={`/tabla?grupo=${group.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-volt-400 hover:text-volt-300"
            >
              Ver tabla <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function AdminGruposPage() {
  return (
    <Suspense fallback={null}>
      <AdminGruposContent />
    </Suspense>
  );
}
