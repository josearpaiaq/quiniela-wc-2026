import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import type { ScoreRecord } from "@/lib/dto";
import { QuinielaClient } from "./quiniela-client";

export const dynamic = "force-dynamic";

export default async function QuinielaPage() {
  const session = await requireUser();
  const db = getDb();

  const [overrideRows, predictionRows, resultRows] = await Promise.all([
    db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(eq(schema.matches.openOverride, true)),
    db
      .select()
      .from(schema.predictions)
      .where(eq(schema.predictions.userId, session.sub)),
    db.select().from(schema.results),
  ]);

  const initialPredictions: ScoreRecord = {};
  for (const row of predictionRows) {
    initialPredictions[row.matchId] = {
      home: row.homeScore,
      away: row.awayScore,
      winnerSide: row.winnerSide,
    };
  }

  const results: ScoreRecord = {};
  for (const row of resultRows) {
    results[row.matchId] = {
      home: row.homeScore,
      away: row.awayScore,
      winnerSide: row.winnerSide,
    };
  }

  return (
    <QuinielaClient
      initialPredictions={initialPredictions}
      results={results}
      openOverrides={overrideRows.map((r) => r.id)}
    />
  );
}
