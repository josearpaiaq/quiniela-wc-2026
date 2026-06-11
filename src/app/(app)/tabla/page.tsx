import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { scoreUser, type Score } from "@/lib/tournament";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function TablaPage() {
  const session = await requireUser();
  const db = getDb();

  const [users, predictionRows, resultRows, overrideRows] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.predictions),
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

      <p className="px-1 text-center text-[11px] text-ink-500">
        Toca a un participante para ver sus pronósticos — solo los de partidos ya bloqueados.
      </p>
    </div>
  );
}
