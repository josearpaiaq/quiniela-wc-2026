import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TeamLabel } from "@/components/team-label";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { MATCHES } from "@/lib/db/seed-data";
import { TEAM_BY_CODE } from "@/lib/dto";
import { formatKickoff } from "@/lib/format";
import { isMatchOpen } from "@/lib/rules";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { buildBracket, scoreUser, ROUND_VALUES, type ScoredRound } from "@/lib/tournament";

const ROUND_LABELS: Record<ScoredRound, string> = {
  r32: "En dieciseisavos",
  r16: "En octavos",
  qf: "En cuartos",
  sf: "En semis",
  final: "En la final",
  champion: "Campeón",
};

export default async function QuinielaAjenaPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requireUser();
  const { userId } = await params;
  const db = getDb();

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
    .catch(() => []);
  if (!user) notFound();

  // only co-members of some group (or the admin) can browse a user's sheet;
  // notFound, not redirect, so existence isn't revealed
  if (!session.admin && session.sub !== userId) {
    const [mine, theirs] = await Promise.all([
      db
        .select({ groupId: schema.groupMembers.groupId })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.userId, session.sub)),
      db
        .select({ groupId: schema.groupMembers.groupId })
        .from(schema.groupMembers)
        .where(eq(schema.groupMembers.userId, userId)),
    ]);
    const myGroups = new Set(mine.map((row) => row.groupId));
    if (!theirs.some((row) => myGroups.has(row.groupId))) notFound();
  }

  const [predictionRows, resultRows, overrideRows, openRows] = await Promise.all([
    db.select().from(schema.predictions).where(eq(schema.predictions.userId, userId)),
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
    db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(eq(schema.matches.openOverride, true)),
  ]);

  const predictions = rowsToScoreMap(predictionRows);
  const results = rowsToScoreMap(resultRows);
  const overrides = overrideRowsToMap(overrideRows);
  const openOverrideIds = new Set(openRows.map((r) => r.id));
  const score = scoreUser(predictions, results, overrides);
  // Knockout slot teams come from their own bracket. By the time a knockout
  // match locks, every group prediction feeding it is locked too — no leak.
  const theirBracket = buildBracket(predictions);

  // Anti-copy: only predictions for matches that can no longer be edited.
  const now = new Date();
  const visible = MATCHES.filter((m) => {
    const locked = !isMatchOpen(
      { kickoffAt: new Date(m.kickoffAt), openOverride: openOverrideIds.has(m.id) },
      now,
    );
    return locked && predictions.has(m.id);
  }).sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/tabla"
          className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-volt-400"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Volver a la tabla
        </Link>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold">{user.displayName}</h2>
            <p className="text-xs text-ink-500">
              {user.firstName} {user.lastName}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-bold text-volt-400">{score.total}</p>
            <p className="font-mono text-[11px] text-ink-500">
              Grupos {score.groupPoints} · Avance {score.advancePoints}
            </p>
          </div>
        </div>
      </div>

      {/* advancement hits */}
      <section className="rounded-xl border border-line bg-pitch-900 p-4">
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Aciertos de avance
        </h3>
        <div className="space-y-2">
          {(Object.keys(ROUND_LABELS) as ScoredRound[]).map((round) => {
            const data = score.advanceByRound.get(round);
            if (!data) return null;
            return (
              <div key={round} className="flex flex-col text-sm">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-ink-500">
                    {ROUND_LABELS[round]}
                    <span className="ml-1.5 font-mono text-[10px]">×{ROUND_VALUES[round]}</span>
                  </span>
                  <span className="flex justify-end gap-1">
                    <span className="ml-1 font-mono text-xs font-semibold text-volt-400">
                      +{data.points}
                    </span>
                  </span>
                </div>
                <div className="flex justify-end flex-wrap gap-1">
                  {data.hits.map((code) => (
                    <div key={code}>
                      <span title={TEAM_BY_CODE.get(code)?.name} aria-hidden>
                        {TEAM_BY_CODE.get(code)?.flag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* locked predictions */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Pronósticos visibles ({visible.length})
        </h3>
        {visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-bright px-4 py-6 text-center text-sm text-ink-500">
            Todavía no hay partidos bloqueados con pronóstico de {user.displayName}.
          </p>
        )}
        {visible.map((match) => {
          const prediction = predictions.get(match.id)!;
          const real = results.get(match.id);
          const points = score.groupPointsByMatch.get(match.id);
          const slot =
            match.phase === "group"
              ? { home: match.home ?? null, away: match.away ?? null }
              : (theirBracket.get(match.id) ?? { home: null, away: null });
          return (
            <div
              key={match.id}
              className="space-y-2 rounded-lg border border-line bg-pitch-900 px-3 py-2.5 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="rounded bg-pitch-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">
                    P{match.id}
                  </span>
                  <span className="truncate text-xs text-ink-500" suppressHydrationWarning>
                    {formatKickoff(match.kickoffAt)}
                  </span>
                </span>
                {points !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                      points === 3
                        ? "bg-volt-400/15 text-volt-400"
                        : points === 1
                          ? "bg-gold-400/15 text-gold-400"
                          : "bg-pitch-700 text-ink-500"
                    }`}
                  >
                    +{points}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <TeamLabel code={slot.home} />
                <span className="text-center">
                  <span className="font-mono font-semibold">
                    {prediction.home}–{prediction.away}
                  </span>
                  {real && (
                    <span className="block font-mono text-[11px] text-ink-500">
                      real {real.home}–{real.away}
                    </span>
                  )}
                </span>
                <TeamLabel code={slot.away} align="right" />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

