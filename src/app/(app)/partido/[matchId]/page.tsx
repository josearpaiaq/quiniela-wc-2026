import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BattleArena } from "@/components/battle-arena";
import { GroupSelect } from "@/components/group-select";
import { PenaltyBadge } from "@/components/penalty-badge";
import { TeamLabel } from "@/components/team-label";
import { requireUser } from "@/lib/auth/session";
import { isBattleOpen } from "@/lib/battle/rules";
import { getDb, schema } from "@/lib/db";
import { getVisibleGroups } from "@/lib/groups";
import { MATCHES } from "@/lib/db/seed-data";
import { formatKickoff, shortVenue } from "@/lib/format";
import { isPredictionVisibleToOthers } from "@/lib/rules";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import {
  buildBracket,
  groupMatchPoints,
  knockoutMatchPoints,
  thirdPlaceMatchPoints,
  ROUND_VALUES,
} from "@/lib/tournament";
import { KNOCKOUT_EXACT_POINTS } from "@/lib/tournament/scoring";

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
  const [[matchRow], userRows, resultRows, overrideRows, [battleRow]] = await Promise.all([
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
    db
      .select({
        home: sql<number>`coalesce(sum(${schema.battleClicks.homeClicks}), 0)::int`,
        away: sql<number>`coalesce(sum(${schema.battleClicks.awayClicks}), 0)::int`,
      })
      .from(schema.battleClicks)
      .where(eq(schema.battleClicks.matchId, matchId)),
  ]);

  // Anti-copy: others' picks are revealed only once the match can't be edited.
  const visible = isPredictionVisibleToOthers({
    kickoffAt: new Date(match.kickoffAt),
    openOverride: matchRow?.openOverride ?? false,
  });

  const results = rowsToScoreMap(resultRows);
  const real = results.get(matchId);
  // Slot teams are the real ones: this view compares everyone on one match.
  const slot =
    match.phase === "group"
      ? { home: match.home ?? null, away: match.away ?? null }
      : (buildBracket(results, overrideRowsToMap(overrideRows)).get(matchId) ?? {
          home: null,
          away: null,
        });

  const rowsRaw = userRows
    .map((u) => {
      const prediction =
        u.homeScore !== null && u.awayScore !== null
          ? { home: u.homeScore, away: u.awayScore, winnerSide: u.winnerSide }
          : null;
      let points: number | null = null;
      if (prediction && real !== undefined) {
        if (match.phase === "group") {
          points = groupMatchPoints(prediction, real);
        } else if (match.phase === "third") {
          points = thirdPlaceMatchPoints(prediction, real);
        } else {
          points = knockoutMatchPoints(match.phase, prediction, real);
        }
      }
      return { ...u, prediction, points };
    })
    .sort(
      (a, b) =>
        Number(b.prediction !== null) - Number(a.prediction !== null) ||
        (b.points ?? 0) - (a.points ?? 0) ||
        a.displayName.localeCompare(b.displayName),
    );

  // show the viewer's own predictions first (admins can view groups they don't belong to)
  const own = rowsRaw.find((r) => r.userId === session.sub);
  const rows = own ? [own, ...rowsRaw.filter((r) => r !== own)] : rowsRaw;

  const battleTotals = { home: battleRow?.home ?? 0, away: battleRow?.away ?? 0 };
  const battleOpen = isBattleOpen({
    kickoffAt: new Date(match.kickoffAt),
    slot,
    hasResult: real !== undefined,
  });
  // hidden until both teams are known; a finished battle stays visible, frozen
  const showBattle =
    slot.home !== null &&
    slot.away !== null &&
    (battleOpen || battleTotals.home + battleTotals.away > 0);

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
            <div className="flex shrink-0 flex-col items-center gap-0.5">
              <span className="whitespace-nowrap font-mono text-xl font-bold">
                {real ? `${real.home}–${real.away}` : "vs"}
              </span>
              {real && (
                <PenaltyBadge winnerSide={real.winnerSide} homeCode={slot.home} awayCode={slot.away} />
              )}
            </div>
            <TeamLabel code={slot.away} align="right" />
          </div>
          {match.phase === "third" && (
            <p className="mt-2 text-center text-[10px] text-gold-400">
              Puntúa como una semifinal: acertar al ganador +{ROUND_VALUES.final} pts · marcador
              exacto +{KNOCKOUT_EXACT_POINTS} pts
            </p>
          )}
        </div>
      </div>

      {showBattle && slot.home && slot.away && (
        <BattleArena
          matchId={matchId}
          homeCode={slot.home}
          awayCode={slot.away}
          kickoffAt={match.kickoffAt}
          open={battleOpen}
          initialTotals={battleTotals}
          viewerId={session.sub}
        />
      )}

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          {selected ? `Pronósticos de ${selected.name}` : "Pronósticos del grupo"}
        </h3>
        <GroupSelect
          groups={visibleGroups}
          selectedId={selected?.id ?? ""}
          basePath={`/partido/${matchId}`}
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
              className={`space-y-1.5 rounded-lg border border-line bg-pitch-900 px-3 py-2.5 text-sm ${row.userId === session.sub ? "sticky top-15 z-10 bg-linear-to-b from-volt-400/10 to-volt-400/10" : ""}`}
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
                      row.points > 1
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
                    <PenaltyBadge
                      winnerSide={row.prediction.winnerSide}
                      homeCode={slot.home}
                      awayCode={slot.away}
                    />
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

export default PartidoContent;
