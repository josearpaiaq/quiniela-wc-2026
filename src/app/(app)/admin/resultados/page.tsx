import { requireAdmin } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { overrideRowsToMap, rowsToScoreMap, scoreMapToRecord } from "@/lib/score-rows";
import { buildBracket } from "@/lib/tournament";
import { AdminTabs } from "../admin-tabs";
import { AdminClient, type AdminOverrideRecord } from "./admin-client";

async function AdminResultadosContent() {
  await requireAdmin();
  const db = getDb();

  const [matchRows, resultRows, overrideRows] = await Promise.all([
    db.select({ id: schema.matches.id, openOverride: schema.matches.openOverride }).from(schema.matches),
    db.select().from(schema.results),
    db.select().from(schema.knockoutOverrides),
  ]);

  const results = rowsToScoreMap(resultRows);
  const overrides = overrideRowsToMap(overrideRows);
  const realBracket = buildBracket(results, overrides);

  const realSlots: Record<number, { home: string | null; away: string | null }> = {};
  for (const [id, slot] of realBracket) realSlots[id] = slot;

  const overrideRecord: AdminOverrideRecord = {};
  for (const row of overrideRows) {
    overrideRecord[row.matchId] = {
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
    };
  }

  return (
    <div className="space-y-4">
      <AdminTabs active="/admin/resultados" />
      <AdminClient
        results={scoreMapToRecord(results)}
        realSlots={realSlots}
        openOverrides={matchRows.filter((m) => m.openOverride).map((m) => m.id)}
        knockoutOverrides={overrideRecord}
      />
    </div>
  );
}

export default AdminResultadosContent;
