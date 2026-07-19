import { connection } from "next/server";
import { MATCHES } from "@/lib/db/seed-data";
import { getDb, schema } from "@/lib/db";
import { TEAM_BY_CODE } from "@/lib/dto";
import { overrideRowsToMap, rowsToScoreMap } from "@/lib/score-rows";
import { buildBracket } from "@/lib/tournament";

const FINAL_MATCH_ID = 104;

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Shown app-wide on the day of the final, with the finalists once known. */
export async function FinalDayTicker() {
  const finalMatch = MATCHES.find((m) => m.id === FINAL_MATCH_ID);
  if (!finalMatch) return null;

  // new Date() needs a request-time signal under Cache Components — this
  // component must produce different output per request/day, not once at
  // build time. Cheap: doesn't touch the DB, just opts out of prerendering.
  await connection();

  const todayKey = localDateKey(new Date());
  const finalDayKey = localDateKey(new Date(finalMatch.kickoffAt));
  if (todayKey !== finalDayKey) return null;

  const db = getDb();
  const [resultRows, overrideRows] = await Promise.all([
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
  ]);
  const scores = rowsToScoreMap(resultRows);
  const overrides = overrideRowsToMap(overrideRows);
  const finalSlot = buildBracket(scores, overrides).get(FINAL_MATCH_ID);
  const home = finalSlot?.home ? TEAM_BY_CODE.get(finalSlot.home) : null;
  const away = finalSlot?.away ? TEAM_BY_CODE.get(finalSlot.away) : null;

  const text =
    home && away
      ? `🏆 HOY ES LA FINAL DEL MUNDIAL — ${home.flag} ${home.name} vs ${away.name} ${away.flag} — 🏆`
      : "🏆 HOY ES LA FINAL DEL MUNDIAL 🏆";

  return (
    <div className="final-day-ticker" aria-live="off">
      <span className="final-day-ticker-track">{text}</span>
    </div>
  );
}
