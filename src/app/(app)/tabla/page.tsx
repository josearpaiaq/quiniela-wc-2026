import { asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getUserGroups, type UserGroup } from "@/lib/groups";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { scoreUser, type Score } from "@/lib/tournament";
import { JoinGroupForm } from "./join-group-form";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function TablaPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string | string[] }>;
}) {
  const session = await requireUser();
  const db = getDb();
  const { grupo } = await searchParams;

  // admin sees every group's standings; players only the groups they joined
  const visibleGroups: UserGroup[] = session.admin
    ? await db
        .select({
          id: schema.groups.id,
          name: schema.groups.name,
          inviteCode: schema.groups.inviteCode,
        })
        .from(schema.groups)
        .orderBy(asc(schema.groups.createdAt))
    : await getUserGroups(session.sub);

  if (visibleGroups.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="font-display text-xl font-bold uppercase">La tabla</h2>
        </header>
        {session.admin ? (
          <p className="rounded-xl border border-dashed border-line-bright px-4 py-8 text-center text-sm text-ink-500">
            Aún no hay grupos.{" "}
            <Link href="/admin/grupos" className="font-medium text-volt-400 hover:text-volt-300">
              Crea el primero →
            </Link>
          </p>
        ) : (
          <JoinGroupForm variant="empty-state" />
        )}
      </div>
    );
  }

  const requested = typeof grupo === "string" ? grupo : undefined;
  // invalid/foreign ids fall back silently — lookup is within the viewer's own list
  const selected = visibleGroups.find((g) => g.id === requested) ?? visibleGroups[0];

  const memberRows = await db
    .select({ user: schema.users })
    .from(schema.groupMembers)
    .innerJoin(schema.users, eq(schema.groupMembers.userId, schema.users.id))
    .where(eq(schema.groupMembers.groupId, selected.id));
  const users = memberRows.map((row) => row.user);
  const memberIds = users.map((user) => user.id);

  const [predictionRows, resultRows, overrideRows] = await Promise.all([
    memberIds.length > 0
      ? db
          .select()
          .from(schema.predictions)
          .where(inArray(schema.predictions.userId, memberIds))
      : Promise.resolve([]),
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
  ]);

  const results = rowsToScoreMap(resultRows);
  const overrides = overrideRowsToMap(overrideRows);

  const byUser = new Map<string, Map<number, Score>>();
  for (const row of predictionRows) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, new Map());
    byUser.get(row.userId)!.set(row.matchId, {
      home: row.homeScore,
      away: row.awayScore,
      winnerSide: row.winnerSide,
    });
  }

  const standings = users
    .map((user) => {
      const score = scoreUser(byUser.get(user.id) ?? new Map(), results, overrides);
      return { user, score, filled: byUser.get(user.id)?.size ?? 0 };
    })
    .sort(
      (a, b) =>
        b.score.total - a.score.total ||
        b.score.groupPoints - a.score.groupPoints ||
        a.user.displayName.localeCompare(b.user.displayName),
    );

  const anyResults = results.size > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold uppercase">La tabla</h2>
        <p className="text-xs text-ink-500">
          {anyResults
            ? `${results.size} de 104 resultados oficiales`
            : "Aún sin resultados oficiales"}
        </p>
      </header>

      {visibleGroups.length > 1 && (
        <nav className="flex flex-wrap gap-1 rounded-lg border border-line p-0.5 self-start">
          {visibleGroups.map((group) => (
            <Link
              key={group.id}
              href={`/tabla?grupo=${group.id}`}
              className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                group.id === selected.id
                  ? "bg-volt-400 text-pitch-950"
                  : "text-ink-500 hover:text-ink-300"
              }`}
            >
              {group.name}
            </Link>
          ))}
        </nav>
      )}

      {standings.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-bright px-4 py-8 text-center text-sm text-ink-500">
          Este grupo todavía no tiene participantes.
        </p>
      )}

      <ol className="space-y-2">
        {standings.map(({ user, score, filled }, index) => {
          const isMe = user.id === session.sub;
          const medal = MEDALS[index];
          return (
            <li key={user.id}>
              <Link
                href={`/tabla/${user.id}`}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:border-line-bright ${
                  isMe ? "border-volt-400/50 bg-volt-400/5" : "border-line bg-pitch-900"
                } ${index === 0 ? "shadow-[0_0_30px_rgba(255,198,63,0.08)]" : ""}`}
              >
                <span className="w-8 text-center font-display text-lg font-extrabold">
                  {medal ?? <span className="text-ink-500">{index + 1}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {user.displayName}
                    {isMe && <span className="ml-2 text-[10px] uppercase text-volt-400">tú</span>}
                  </span>
                  <span className="block text-[11px] text-ink-500">
                    {filled}/104 pronosticados
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-[11px] text-ink-500">
                    G {score.groupPoints} · Av {score.advancePoints}
                  </span>
                  <span className="block font-mono text-xl font-bold text-volt-400">
                    {score.total}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {standings.length > 0 && (
        <p className="px-1 text-center text-[11px] text-ink-500">
          Toca a un participante para ver sus pronósticos — solo los de partidos ya bloqueados.
        </p>
      )}

      <JoinGroupForm variant="discreet" />
    </div>
  );
}
