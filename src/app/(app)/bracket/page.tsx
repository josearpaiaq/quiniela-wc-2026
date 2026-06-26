import { getDb, schema } from "@/lib/db";
import { overrideRowsToMap, rowsToScoreMap, scoreMapToRecord } from "@/lib/score-rows";
import { buildBracket } from "@/lib/tournament";
import { BracketView } from "./bracket-view";

async function BracketContent() {
  const db = getDb();

  const [resultRows, overrideRows] = await Promise.all([
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
  ]);

  const realScores = rowsToScoreMap(resultRows);
  const overrides = overrideRowsToMap(overrideRows);

  const toSlots = (bracket: ReturnType<typeof buildBracket>) => {
    const slots: Record<number, { home: string | null; away: string | null }> = {};
    for (const [id, slot] of bracket) slots[id] = slot;
    return slots;
  };

  return (
    <BracketView
      slots={toSlots(buildBracket(realScores, overrides))}
      scores={scoreMapToRecord(realScores)}
    />
  );
}

export default BracketContent;
