import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TeamLabel } from "@/components/team-label";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { MATCHES } from "@/lib/db/seed-data";
import { TEAM_BY_CODE } from "@/lib/dto";
import { formatKickoff, shortVenue } from "@/lib/format";
import { isPredictionVisibleToOthers } from "@/lib/rules";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { buildBracket, groupMatchPoints } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  await requireUser();
  const { matchId: rawId } = await params;
  const matchId = Number(rawId);
  const match = MATCHES.find((m) => m.id === matchId);
  if (!match) notFound();

  const db = getDb();
  const [[matchRow], userRows, resultRows, overrideRows] = await Promise.all([
    db
      .select({ openOverride: schema.matches.openOverride })
      .from(schema.matches)
      .where(eq(schema.matches.id, matchId))
      .limit(1),
    db
      .select({
        userId: schema.users.id,
        displayName: schema.users.displayName,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        homeScore: schema.predictions.homeScore,
        awayScore: schema.predictions.awayScore,
        winnerSide: schema.predictions.winnerSide,
      })
      .from(schema.users)
      .leftJoin(
        schema.predictions,
        and(
          eq(schema.predictions.userId, schema.users.id),
          eq(schema.predictions.matchId, matchId),
        ),
      ),
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
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
            <span className="font-mono text-xl font-bold">
              {real ? `${real.home}–${real.away}` : "vs"}
            </span>
            <TeamLabel code={slot.away} align="right" />
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Pronósticos de todos
        </h3>
        {!visible ? (
          <p className="rounded-xl border border-dashed border-line-bright px-4 py-6 text-center text-sm text-ink-500">
            Los pronósticos se revelan cuando el partido cierra.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.userId}
              className="space-y-1.5 rounded-lg border border-line bg-pitch-900 px-3 py-2.5 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/tabla/${row.userId}`}
                  className="min-w-0 truncate hover:text-volt-400"
                >
                  {row.displayName}{" "}
                  <span className="text-xs text-ink-500">
                    ({row.firstName} {row.lastName})
                  </span>
                </Link>
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
