import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { MATCHES, type GroupLetter, type Phase } from "@/lib/db/seed-data";
import { TEAM_BY_CODE } from "@/lib/dto";
import { isMatchOpen } from "@/lib/rules";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import {
  buildBracket,
  computeGroupStandings,
  GROUP_LETTERS,
  knockoutMatchPoints,
  scoreUser,
  ROUND_VALUES,
  type ScoredRound,
} from "@/lib/tournament";
import { type PredictionCard, PredictionList } from "./prediction-list";

const ROUND_LABELS: Record<ScoredRound, string> = {
  r32: "En 16avos",
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
  const realBracket = buildBracket(results, overrides);

  // Real final positions for each team (used to sort advance-hit flags).
  const finalPositionByCode = new Map<string, { group: GroupLetter; position: number }>();
  for (const group of GROUP_LETTERS) {
    for (const [index, row] of computeGroupStandings(group, results).entries()) {
      finalPositionByCode.set(row.code, { group, position: index + 1 });
    }
  }

  const sortHits = (hits: string[]) =>
    [...hits].sort((a, b) => {
      const pa = finalPositionByCode.get(a);
      const pb = finalPositionByCode.get(b);
      const aThird = (pa?.position ?? 1) > 2;
      const bThird = (pb?.position ?? 1) > 2;
      if (aThird !== bThird) return aThird ? 1 : -1;
      const gc = (pa?.group ?? "Z").localeCompare(pb?.group ?? "Z");
      return gc !== 0 ? gc : (pa?.position ?? 1) - (pb?.position ?? 1);
    });

  // Anti-copy: only predictions for matches that can no longer be edited.
  const now = new Date();
  const knockoutPtsByMatch = new Map<number, number>();
  for (const m of MATCHES) {
    if (m.phase === "group" || m.phase === "third") continue;
    const prediction = predictions.get(m.id);
    const real = results.get(m.id);
    if (!prediction || !real) continue;
    knockoutPtsByMatch.set(m.id, knockoutMatchPoints(m.phase, prediction, real));
  }
  const pointsByMatch = new Map<number, number>([
    ...score.groupPointsByMatch,
    ...knockoutPtsByMatch,
  ]);

  const r32AdvancePoints = score.advanceByRound.get("r32")?.points ?? 0;
  const phasePoints = new Map<Phase, number>([["group", score.groupPoints + r32AdvancePoints]]);
  for (const m of MATCHES) {
    if (m.phase === "group" || m.phase === "third") continue;
    const pts = knockoutPtsByMatch.get(m.id);
    if (pts !== undefined) {
      phasePoints.set(m.phase, (phasePoints.get(m.phase) ?? 0) + pts);
    }
  }

  const PHASE_BREAKDOWN: { phase: Phase; label: string }[] = [
    { phase: "group", label: "Grupos" },
    { phase: "r32", label: "16avos" },
    { phase: "r16", label: "Octavos" },
    { phase: "qf", label: "Cuartos" },
    { phase: "sf", label: "Semis" },
    { phase: "final", label: "Final" },
  ];

  const matchCards: PredictionCard[] = MATCHES.filter((m) => {
    const locked = !isMatchOpen(
      { kickoffAt: new Date(m.kickoffAt), openOverride: openOverrideIds.has(m.id) },
      now,
    );
    return locked && predictions.has(m.id);
  })
    .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt))
    .map((m) => {
      const prediction = predictions.get(m.id)!;
      const real = results.get(m.id);
      const slot =
        m.phase === "group"
          ? { home: m.home ?? null, away: m.away ?? null }
          : (realBracket.get(m.id) ?? { home: null, away: null });
      return {
        id: m.id,
        phase: m.phase,
        kickoffAt: m.kickoffAt,
        homeCode: slot.home,
        awayCode: slot.away,
        predictedHome: prediction.home,
        predictedAway: prediction.away,
        realHome: real?.home ?? null,
        realAway: real?.away ?? null,
        points: pointsByMatch.get(m.id),
      };
    });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/tabla"
          className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-volt-400"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Volver a la tabla
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold">{user.displayName}</h2>
            <p className="text-xs text-ink-500">
              {user.firstName} {user.lastName}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl font-bold text-volt-400">{score.total}</p>
            <p className="font-mono text-[10px] text-ink-500">puntos totales</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {PHASE_BREAKDOWN.map(({ phase, label }) => {
            const pts = phasePoints.get(phase) ?? 0;
            return (
              <div
                key={phase}
                className="rounded-lg border border-line bg-pitch-900 px-2 py-1.5 text-center"
              >
                <p className={`font-mono text-lg font-bold ${pts > 0 ? "text-volt-400" : "text-ink-600"}`}>
                  {pts}
                </p>
                <p className="text-[10px] text-ink-500">{label}</p>
              </div>
            );
          })}
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
                  {sortHits(data.hits).map((code) => (
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

      <PredictionList cards={matchCards} />
    </div>
  );
}

