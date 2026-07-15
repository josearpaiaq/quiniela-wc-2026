import { desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import {
  battleFlushSchema,
  FLUSH_MIN_INTERVAL_MS,
  isBattleOpen,
  type BattleSlot,
} from "@/lib/battle/rules";
import { getDb, schema } from "@/lib/db";
import { MATCHES } from "@/lib/db/seed-data";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { buildBracket } from "@/lib/tournament";

type Db = ReturnType<typeof getDb>;
type SeedMatch = (typeof MATCHES)[number];

async function resolveSlot(db: Db, match: SeedMatch): Promise<BattleSlot> {
  if (match.phase === "group") {
    return { home: match.home ?? null, away: match.away ?? null };
  }
  const [resultRows, overrideRows] = await Promise.all([
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
  ]);
  return (
    buildBracket(rowsToScoreMap(resultRows), overrideRowsToMap(overrideRows)).get(match.id) ?? {
      home: null,
      away: null,
    }
  );
}

// totals + per-user breakdown in one query; totals are summed here (tens of rows)
async function getBattleState(db: Db, matchId: number) {
  const users = await db
    .select({
      userId: schema.battleClicks.userId,
      name: schema.users.displayName,
      home: schema.battleClicks.homeClicks,
      away: schema.battleClicks.awayClicks,
    })
    .from(schema.battleClicks)
    .innerJoin(schema.users, eq(schema.battleClicks.userId, schema.users.id))
    .where(eq(schema.battleClicks.matchId, matchId))
    .orderBy(desc(sql`${schema.battleClicks.homeClicks} + ${schema.battleClicks.awayClicks}`));
  let home = 0;
  let away = 0;
  for (const u of users) {
    home += u.home;
    away += u.away;
  }
  return { home, away, users };
}

// Auth lives in the proxy (it verifies the JWT before the CDN cache). The
// handler itself must not read cookies: the response is one shared, non
// personal payload that the CDN serves to every viewer.
export async function GET(_req: Request, ctx: RouteContext<"/api/battle/[matchId]">) {
  const { matchId: rawId } = await ctx.params;
  const matchId = Number(rawId);
  if (!MATCHES.some((m) => m.id === matchId)) {
    return Response.json({ error: "Partido no existe" }, { status: 404 });
  }

  const state = await getBattleState(getDb(), matchId);
  return Response.json(state, {
    headers: { "Cache-Control": "public, s-maxage=2, stale-while-revalidate=5" },
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/battle/[matchId]">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { matchId: rawId } = await ctx.params;
  const matchId = Number(rawId);
  const match = MATCHES.find((m) => m.id === matchId);
  if (!match) return Response.json({ error: "Partido no existe" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }
  const parsed = battleFlushSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Body inválido" }, { status: 400 });

  const db = getDb();

  // Re-checked server-side so nobody votes an undefined future match via curl.
  const slot = await resolveSlot(db, match);
  if (!isBattleOpen({ kickoffAt: new Date(match.kickoffAt), slot })) {
    return Response.json({ error: "El battle está cerrado" }, { status: 409 });
  }

  // Increment and rate limit in one atomic statement: concurrent flushes from
  // the same user can't double-spend because the interval check lives in the
  // conflict clause. No row updated -> flushing faster than a human can click.
  const updated = await db
    .insert(schema.battleClicks)
    .values({
      matchId,
      userId: session.sub,
      homeClicks: parsed.data.home,
      awayClicks: parsed.data.away,
    })
    .onConflictDoUpdate({
      target: [schema.battleClicks.matchId, schema.battleClicks.userId],
      set: {
        homeClicks: sql`${schema.battleClicks.homeClicks} + excluded.home_clicks`,
        awayClicks: sql`${schema.battleClicks.awayClicks} + excluded.away_clicks`,
        lastFlushAt: sql`now()`,
      },
      setWhere: sql`${schema.battleClicks.lastFlushAt} < now() - make_interval(secs => ${FLUSH_MIN_INTERVAL_MS / 1000})`,
    })
    .returning({ matchId: schema.battleClicks.matchId });

  const state = await getBattleState(db, matchId);
  return Response.json(
    { accepted: updated.length > 0, ...state },
    { headers: { "Cache-Control": "no-store" } },
  );
}
