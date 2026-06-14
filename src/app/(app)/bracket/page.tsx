import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { overrideRowsToMap, rowsToScoreMap, scoreMapToRecord } from "@/lib/score-rows";
import { allGroupsComplete, buildBracket } from "@/lib/tournament";
import { BracketView } from "./bracket-view";

async function BracketContent() {
  const session = await requireUser();
  const db = getDb();

  const [predictionRows, resultRows, overrideRows] = await Promise.all([
    db.select().from(schema.predictions).where(eq(schema.predictions.userId, session.sub)),
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
  ]);

  const myScores = rowsToScoreMap(predictionRows);
  const realScores = rowsToScoreMap(resultRows);
  const overrides = overrideRowsToMap(overrideRows);

  const toSlots = (bracket: ReturnType<typeof buildBracket>) => {
    const slots: Record<number, { home: string | null; away: string | null }> = {};
    for (const [id, slot] of bracket) slots[id] = slot;
    return slots;
  };

  return (
    <BracketView
      mySlots={toSlots(buildBracket(myScores))}
      myScores={scoreMapToRecord(myScores)}
      realSlots={toSlots(buildBracket(realScores, overrides))}
      realScores={scoreMapToRecord(realScores)}
      bracketReady={allGroupsComplete(myScores)}
    />
  );
}

export default function BracketPage() {
  return (
    <Suspense fallback={null}>
      <BracketContent />
    </Suspense>
  );
}
