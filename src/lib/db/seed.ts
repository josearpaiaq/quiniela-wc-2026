import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { MATCHES, TEAMS } from "./seed-data";
import * as schema from "./schema";

// Idempotent: upserts teams and matches. Never touches admin state
// (open_override) nor user data (users, predictions, results).
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = drizzle(neon(url), { schema });

  const teamRows = TEAMS.map((team, index) => ({
    id: index + 1,
    fifaCode: team.code,
    name: team.name,
    flag: team.flag,
    groupLetter: team.group,
    drawPosition: team.drawPosition,
  }));
  const idByCode = new Map(teamRows.map((row) => [row.fifaCode, row.id]));

  await db
    .insert(schema.teams)
    .values(teamRows)
    .onConflictDoUpdate({
      target: schema.teams.id,
      set: {
        fifaCode: sql`excluded.fifa_code`,
        name: sql`excluded.name`,
        flag: sql`excluded.flag`,
        groupLetter: sql`excluded.group_letter`,
        drawPosition: sql`excluded.draw_position`,
      },
    });

  const matchRows = MATCHES.map((match) => ({
    id: match.id,
    phase: match.phase,
    groupLetter: match.group ?? null,
    kickoffAt: new Date(match.kickoffAt),
    venue: match.venue,
    homeTeamId: match.home ? idByCode.get(match.home)! : null,
    awayTeamId: match.away ? idByCode.get(match.away)! : null,
    homeSource: match.homeSource ?? null,
    awaySource: match.awaySource ?? null,
  }));

  await db
    .insert(schema.matches)
    .values(matchRows)
    .onConflictDoUpdate({
      target: schema.matches.id,
      set: {
        phase: sql`excluded.phase`,
        groupLetter: sql`excluded.group_letter`,
        kickoffAt: sql`excluded.kickoff_at`,
        venue: sql`excluded.venue`,
        homeTeamId: sql`excluded.home_team_id`,
        awayTeamId: sql`excluded.away_team_id`,
        homeSource: sql`excluded.home_source`,
        awaySource: sql`excluded.away_source`,
      },
    });

  const [teamCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.teams);
  const [matchCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.matches);
  console.log(`Seed OK — teams: ${teamCount.count}, matches: ${matchCount.count}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
