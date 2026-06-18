import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GroupTabs } from "@/components/group-tabs";
import { TeamLabel } from "@/components/team-label";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getVisibleGroups } from "@/lib/groups";
import { MATCHES } from "@/lib/db/seed-data";
import { TEAM_BY_CODE } from "@/lib/dto";
import { formatKickoff, shortVenue } from "@/lib/format";
import { isPredictionVisibleToOthers } from "@/lib/rules";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { buildBracket, groupMatchPoints } from "@/lib/tournament";

async function PartidoContent({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ grupo?: string | string[] }>;
}) {
  const session = await requireUser();
  const { matchId: rawId } = await params;
  const { grupo } = await searchParams;
  const matchId = Number(rawId);
  const match = MATCHES.find((m) => m.id === matchId);
  if (!match) notFound();

  // Picks are compared only inside the selected group, never across the whole app.
  const visibleGroups = await getVisibleGroups(session);
  const requested = typeof grupo === "string" ? grupo : undefined;
  // invalid/foreign ids fall back silently — lookup is within the viewer's own list
  const selected = visibleGroups.find((g) => g.id === requested) ?? visibleGroups[0];

  const db = getDb();
  const [[matchRow], userRows, resultRows, overrideRows, liveScoreRows] = await Promise.all([
    db
      .select({ openOverride: schema.matches.openOverride })
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1),
    selected
      ? db
          .select({
            userId: schema.users.id,
            displayName: schema.users.displayName,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            homeScore: schema.predictions.homeScore,
            awayScore: schema.predictions.awayScore,
            winnerSide: schema.predictions.winnerSide,
          })
          .from(schema.groupMembers)
          .innerJoin(schema.users, eq(schema.groupMembers.userId, schema.users.id))
          .leftJoin(
            schema.predictions,
            and(
              eq(schema.predictions.userId, schema.users.id),
              eq(schema.predictions.matchId, matchId),
            ),
          )
          .where(eq(schema.groupMembers.groupId, selected.id))
      : Promise.resolve([]),
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
    db.select().from(schema.liveScores).where(eq(schema.liveScores.matchId, matchId)).limit(1),
  ]);

  // Anti-copy: others' picks are revealed only once the match can't be edited.
  const visible = isPredictionVisibleToOthers({
    kickoffAt: new Date(match.kickoffAt),
    openOverride: matchRow?.openOverride ?? false,
  });

  const results = rowsToScoreMap(resultRows);
  const real = results.get(matchId);
  const liveScore = liveScoreRows[0];
  // Slot teams are the real ones: this view compares everyone on one match.
  const slot =
    match.phase === "group"
      ? { home: match.home ?? null, away: match.away ?? null }
      : (buildBracket(results, overrideRowsToMap(overrideRows)).get(matchId) ?? {
          home: null,
          away: null,
        });

  const scoresPoints = match.phase === "group" && real !== undefined;
  const rows = userRows
    .map((u) => {
      const prediction =
        u.homeScore !== null && u.awayScore !== null
          ? { home: u.homeScore, away: u.awayScore, winnerSide: u.winnerSide }
          : null;
      const points =
        prediction && scoresPoints ? groupMatchPoints(prediction, real) : null;
      return { ...u, prediction, points };
    })
    .sort(
      (a, b) =>
        Number(b.prediction !== null) - Number(a.prediction !== null) ||
        (b.points ?? 0) - (a.points ?? 0) ||
        a.displayName.localeCompare(b.displayName),
    );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/quiniela"
          className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-volt-400"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Volver a la quiniela
        </Link>
        <div className="mt-2 rounded-xl border border-line bg-pitch-900 p-4">
          <p className="mb-2 flex items-center gap-2 text-[11px] text-ink-500">
            <span className="rounded bg-pitch-700 px-1.5 py-0.5 font-mono font-semibold text-ink-300">
              P{match.id}
            </span>
            <time suppressHydrationWarning>{formatKickoff(match.kickoffAt)}</time>
            <span>· {shortVenue(match.venue)}</span>
          </p>
          <div className="flex items-center justify-between gap-2">
            <TeamLabel code={slot.home} />
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-mono text-xl font-bold">
                {real
                  ? `${real.home}–${real.away}`
                  : liveScore
                    ? `${liveScore.homeScore}–${liveScore.awayScore}`
                    : "vs"}
              </span>
              {!real && liveScore && (
                <span className="flex items-center gap-1 rounded-full bg-danger-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger-400" />
                  En vivo
                </span>
              )}
            </div>
            <TeamLabel code={slot.away} align="right" />
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          {selected ? `Pronósticos de ${selected.name}` : "Pronósticos del grupo"}
        </h3>
        <GroupTabs
          groups={visibleGroups}
          selectedId={selected?.id ?? ""}
          hrefFor={(groupId) => `/partido/${matchId}?grupo=${groupId}`}
        />
        {!selected ? (
          <p className="rounded-xl border border-dashed border-line-bright px-4 py-6 text-center text-sm text-ink-500">
            Únete a un grupo desde{" "}
            <Link href="/tabla" className="font-medium text-volt-400 hover:text-volt-300">
              la tabla
            </Link>{" "}
            para comparar pronósticos.
          </p>
        ) : !visible ? (
          <p className="rounded-xl border border-dashed border-line-bright px-4 py-6 text-center text-sm text-ink-500">
            Los pronósticos se revelan cuando el partido cierra.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.userId}
              className={`space-y-1.5 rounded-lg border border-line bg-pitch-900 px-3 py-2.5 text-sm ${row.userId === session.sub ? "bg-volt-400/10" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/tabla/${row.userId}`}
                    className="min-w-0 truncate hover:text-volt-400"
                  >
                    {row.displayName}{" "}
                    <span className="text-xs text-ink-500">
                      ({row.firstName} {row.lastName}){row.userId === session.sub && <span className="ml-2 text-[10px] uppercase text-volt-400">tú</span>}
                    </span>
                  </Link>
                </div>
                {row.points !== null && (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                      row.points === 3
                        ? "bg-volt-400/15 text-volt-400"
                        : row.points === 1
                          ? "bg-gold-400/15 text-gold-400"
                          : "bg-pitch-700 text-ink-500"
                    }`}
                  >
                    +{row.points}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center gap-2">
                {row.prediction ? (
                  <>
                    <span className="font-mono font-semibold">
                      {row.prediction.home}–{row.prediction.away}
                    </span>
                    {row.prediction.winnerSide && (
                      <span className="text-[11px] text-gold-400" title="Avanza en penales">
                        pen{" "}
                        {(() => {
                          const code =
                            row.prediction.winnerSide === "home" ? slot.home : slot.away;
                          return code ? TEAM_BY_CODE.get(code)?.flag : null;
                        })() ??
                          (row.prediction.winnerSide === "home" ? "local" : "visita")}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-ink-500/60">—</span>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export default function PartidoPage(props: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ grupo?: string | string[] }>;
}) {
  return (
    <Suspense fallback={null}>
      <PartidoContent {...props} />
    </Suspense>
  );
}
