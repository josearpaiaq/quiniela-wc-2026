import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import type { ScoreRecord } from "@/lib/dto";
import { overrideRowsToMap } from "@/lib/score-rows";
import { QuinielaClient } from "./quiniela-client";

async function QuinielaContent() {
  const session = await requireUser();
  const db = getDb();

  const [openOverrideRows, predictionRows, resultRows, knockoutOverrideRows] = await Promise.all([
    db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(eq(schema.matches.openOverride, true)),
    db
      .select()
      .from(schema.predictions)
      .where(eq(schema.predictions.userId, session.sub)),
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
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

  const bracketOverrides = [...overrideRowsToMap(knockoutOverrideRows).entries()].map(
    ([matchId, slot]) => ({ matchId, home: slot.home ?? null, away: slot.away ?? null }),
  );

  return (
    <QuinielaClient
      initialPredictions={initialPredictions}
      results={results}
      openOverrides={openOverrideRows.map((r) => r.id)}
      bracketOverrides={bracketOverrides}
    />
  );
}

export default QuinielaContent;
