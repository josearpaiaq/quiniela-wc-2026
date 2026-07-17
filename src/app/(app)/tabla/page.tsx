import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ArrowRight, Medal } from "lucide-react";
import { GroupSelect } from "@/components/group-select";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getVisibleGroups } from "@/lib/groups";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { scoreUser, type Score } from "@/lib/tournament";
import { JoinGroupForm } from "./join-group-form";

async function TablaContent({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string | string[] }>;
}) {
  const session = await requireUser();
  const db = getDb();
  const { grupo } = await searchParams;

  // admin sees every group's standings; players only the groups they joined
  const visibleGroups = await getVisibleGroups(session);

  if (visibleGroups.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="font-display text-xl font-bold uppercase">La tabla</h2>
        </header>
        {session.admin ? (
          <p className="rounded-xl border border-dashed border-line-bright px-4 py-8 text-center text-sm text-ink-500">
            Aún no hay grupos.{" "}
            <Link
              href="/admin/grupos"
              className="inline-flex items-center gap-1 font-medium text-volt-400 hover:text-volt-300"
            >
              Crea el primero <ArrowRight aria-hidden className="h-3.5 w-3.5" />
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
      const predictions = byUser.get(user.id) ?? new Map<number, Score>();
      const score = scoreUser(predictions, results, overrides);
      const exactos = [...predictions].filter(([id, p]) => {
        const real = results.get(id);
        return real !== undefined && p.home === real.home && p.away === real.away;
      }).length;
      return { user, score, filled: predictions.size, exactos };
    })
    .sort(
      (a, b) =>
        b.score.total - a.score.total ||
        b.exactos - a.exactos ||
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

      <GroupSelect groups={visibleGroups} selectedId={selected.id} basePath="/tabla" />

      {standings.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-bright px-4 py-8 text-center text-sm text-ink-500">
          Este grupo todavía no tiene participantes.
        </p>
      )}

      <ol className="space-y-2">
        {standings.map(({ user, score, filled, exactos }, index) => {
          const isMe = user.id === session.sub;
          return (
            <li key={user.id}>
              <Link
                href={`/tabla/${user.id}`}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:border-line-bright ${
                  isMe ? "border-volt-400/50 bg-volt-400/5" : "border-line bg-pitch-900"
                } ${index === 0 ? "shadow-[0_0_30px_rgba(255,198,63,0.08)]" : ""}`}
              >
                <span className="flex w-8 justify-center font-display text-lg font-extrabold">
                  {index === 0 ? (
                    <Medal aria-label="puesto 1" className="h-5 w-5 text-gold-400" />
                  ) : (
                    <span className="text-ink-500">{index + 1}</span>
                  )}
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
                    G {score.groupPoints} · Av {score.advancePoints} · ✓{exactos}
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

export default TablaContent;
