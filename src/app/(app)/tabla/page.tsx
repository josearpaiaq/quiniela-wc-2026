import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ArrowRight, Medal } from "lucide-react";
import {
  ChampionAutoReveal,
  ChampionFireworksProvider,
  ChampionReplayButton,
} from "@/components/champion-fireworks";
import { GroupSelect } from "@/components/group-select";
import { requireUser } from "@/lib/auth/session";
import { computeChampionIds } from "@/lib/champion";
import { getDb, schema } from "@/lib/db";
import { getVisibleGroups } from "@/lib/groups";
import { battleRowsToWinners, overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { scoreUser, type Score } from "@/lib/tournament";
import { JoinGroupForm } from "./join-group-form";

/** Fixed positions/colors/delays — rendered on the server, so no Math.random(). */
const CHAMPION_CONFETTI: {
  left: string;
  duration: string;
  delay: string;
  kind: "dot" | "emoji";
  value: string;
}[] = [
  { left: "6%", duration: "2.4s", delay: "0s", kind: "dot", value: "var(--color-gold-400)" },
  { left: "18%", duration: "2.9s", delay: "0.5s", kind: "dot", value: "var(--color-volt-400)" },
  { left: "28%", duration: "2.6s", delay: "1.1s", kind: "emoji", value: "🎉" },
  { left: "40%", duration: "3.1s", delay: "0.2s", kind: "dot", value: "var(--color-gold-400)" },
  { left: "50%", duration: "2.5s", delay: "1.4s", kind: "dot", value: "var(--color-ink-100)" },
  { left: "60%", duration: "2.8s", delay: "0.7s", kind: "emoji", value: "⭐" },
  { left: "68%", duration: "2.3s", delay: "1.6s", kind: "dot", value: "var(--color-volt-400)" },
  { left: "78%", duration: "3.0s", delay: "0.9s", kind: "dot", value: "var(--color-gold-400)" },
  { left: "86%", duration: "2.7s", delay: "0.3s", kind: "emoji", value: "🎉" },
  { left: "94%", duration: "2.6s", delay: "1.2s", kind: "dot", value: "var(--color-volt-400)" },
];

function ChampionMiniConfetti() {
  return (
    <div className="champion-mini-confetti" aria-hidden>
      {CHAMPION_CONFETTI.map((p, i) =>
        p.kind === "emoji" ? (
          <span
            key={i}
            style={{
              left: p.left,
              fontSize: "12px",
              animation: `champion-mini-fall ${p.duration} ${p.delay} linear infinite`,
            }}
          >
            {p.value}
          </span>
        ) : (
          <span
            key={i}
            style={{
              left: p.left,
              width: "5px",
              height: "10px",
              borderRadius: "2px",
              background: p.value,
              animation: `champion-mini-fall ${p.duration} ${p.delay} linear infinite`,
            }}
          />
        ),
      )}
    </div>
  );
}

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

  const [predictionRows, resultRows, overrideRows, battleRows] = await Promise.all([
    memberIds.length > 0
      ? db
          .select()
          .from(schema.predictions)
          .where(inArray(schema.predictions.userId, memberIds))
      : Promise.resolve([]),
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
    // every user's clicks, not just this group's: the battle is app-wide
    db.select().from(schema.battleClicks),
  ]);

  const results = rowsToScoreMap(resultRows);
  const overrides = overrideRowsToMap(overrideRows);
  const battleWinners = battleRowsToWinners(battleRows);

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
      const score = scoreUser(predictions, results, overrides, battleWinners);
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
  const tournamentComplete = results.size === 104;
  const championIds = computeChampionIds(
    standings.map((s) => ({ id: s.user.id, total: s.score.total, exactos: s.exactos })),
  );

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

      <ChampionFireworksProvider>
        {tournamentComplete && championIds.size > 0 && (
          <ChampionAutoReveal groupId={selected.id} />
        )}
        <ol className="space-y-2">
          {standings.map(({ user, score, filled, exactos }, index) => {
            const isMe = user.id === session.sub;
            const isChampion = tournamentComplete && championIds.has(user.id);
            const showMedal = tournamentComplete ? isChampion : index === 0;
            return (
              <li key={user.id}>
                <Link
                  href={`/tabla/${user.id}`}
                  className={`flex items-center gap-3 rounded-xl border transition hover:border-line-bright ${
                    isChampion ? "pl-4 pr-9 pt-6 pb-3" : "px-4 py-3"
                  } ${isMe ? "border-volt-400/50 bg-volt-400/5" : "border-line bg-pitch-900"} ${
                    index === 0 && !isChampion ? "shadow-[0_0_30px_rgba(255,198,63,0.08)]" : ""
                  } ${isChampion ? "champion-card" : ""}`}
                >
                  {isChampion && (
                    <>
                      <div className="champion-shine" aria-hidden />
                      <div className="champion-ribbon">CAMPEÓN</div>
                      <ChampionMiniConfetti />
                    </>
                  )}
                  <span className="flex w-8 shrink-0 justify-center font-display text-lg font-extrabold">
                    {showMedal ? (
                      isChampion ? (
                        <ChampionReplayButton>
                          <Medal aria-label="puesto 1 — repetir celebración" className="h-5 w-5 text-gold-400" />
                        </ChampionReplayButton>
                      ) : (
                        <Medal aria-label="puesto 1" className="h-5 w-5 text-gold-400" />
                      )
                    ) : (
                      <span className="text-ink-500">{index + 1}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {isChampion && <span className="champion-crown mr-1">👑</span>}
                      {user.displayName}
                      {isMe && <span className="ml-2 text-[10px] uppercase text-volt-400">tú</span>}
                    </span>
                    <span className="block text-[11px] text-ink-500">
                      {filled}/104 pronosticados
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-[11px] text-ink-500">
                      G {score.groupPoints} · Av {score.advancePoints} · B {score.battlePoints} ·
                      ✓{exactos}
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
      </ChampionFireworksProvider>

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
