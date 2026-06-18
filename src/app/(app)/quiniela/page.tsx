import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import type { ScoreRecord } from "@/lib/dto";
import { QuinielaClient } from "./quiniela-client";

async function QuinielaContent() {
  const session = await requireUser();
  const db = getDb();

  const [overrideRows, predictionRows, resultRows, liveScoreRows] = await Promise.all([
    db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(eq(schema.matches.openOverride, true)),
    db
      .select()
      .from(schema.predictions)
      .where(eq(schema.predictions.userId, session.sub)),
    db.select().from(schema.results),
    db.select().from(schema.liveScores),
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

  const liveScores: ScoreRecord = {};
  for (const row of liveScoreRows) {
    liveScores[row.matchId] = { home: row.homeScore, away: row.awayScore, winnerSide: null };
  }

  return (
    <QuinielaClient
      initialPredictions={initialPredictions}
      results={results}
      liveScores={liveScores}
      openOverrides={overrideRows.map((r) => r.id)}
    />
  );
}

export default function QuinielaPage() {
  return (
    <Suspense fallback={null}>
      <QuinielaContent />
    </Suspense>
  );
}
