import * as dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { MATCHES } from "../src/lib/db/seed-data";

dotenv.config({ path: ".env" });

const BASE = "https://api.football-data.org/v4";

function kickoffKey(iso: string): string {
  return iso.slice(0, 16);
}

async function fetchFinished(dateFrom: string, dateTo: string) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY not set");

  const url = `${BASE}/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=FINISHED`;
  const res = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { matches: Array<{
    id: number;
    utcDate: string;
    homeTeam: { tla: string };
    awayTeam: { tla: string };
    score: {
      winner: string | null;
      fullTime: { home: number | null; away: number | null };
      extraTime: { home: number | null; away: number | null } | null;
      penalties: { home: number | null; away: number | null } | null;
    };
  }> };
  return data.matches ?? [];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const db = drizzle(neon(url), { schema });

  const kickoffToSeed = new Map(MATCHES.map((m) => [kickoffKey(m.kickoffAt), m]));

  // Fetch all finished matches from tournament start to today
  const fdMatches = await fetchFinished("2026-06-11", new Date().toISOString().slice(0, 10));
  console.log(`Fetched ${fdMatches.length} finished matches from football-data.org`);

  const existing = await db.select({ matchId: schema.results.matchId }).from(schema.results);
  const entered = new Set(existing.map((r) => r.matchId));
  console.log(`Already have results for ${entered.size} matches`);

  const toInsert: {
    matchId: number;
    homeScore: number;
    awayScore: number;
    winnerSide: "home" | "away" | null;
  }[] = [];
  const skipped: number[] = [];
  const unmatched: string[] = [];

  for (const fd of fdMatches) {
    const seed = kickoffToSeed.get(kickoffKey(fd.utcDate));
    if (!seed) {
      unmatched.push(`fd#${fd.id} ${fd.utcDate} ${fd.homeTeam.tla} vs ${fd.awayTeam.tla}`);
      continue;
    }
    if (entered.has(seed.id)) {
      skipped.push(seed.id);
      continue;
    }

    const fullTime = fd.score.fullTime;
    const extraTime = fd.score.extraTime;
    const penalties = fd.score.penalties;

    const homeScore = extraTime?.home ?? fullTime.home;
    const awayScore = extraTime?.away ?? fullTime.away;
    if (homeScore === null || awayScore === null) continue;

    let winnerSide: "home" | "away" | null = null;
    if (seed.phase !== "group" && penalties?.home !== null) {
      winnerSide = fd.score.winner === "HOME_TEAM" ? "home" : "away";
    }

    toInsert.push({ matchId: seed.id, homeScore, awayScore, winnerSide });
  }

  if (unmatched.length > 0) {
    console.warn("⚠  Unmatched by kickoff time:");
    unmatched.forEach((s) => console.warn("  ", s));
  }
  if (skipped.length > 0) {
    console.log(`Skipped (already in DB): match IDs [${skipped.join(", ")}]`);
  }

  if (toInsert.length === 0) {
    console.log("Nothing new to insert.");
    return;
  }

  await db
    .insert(schema.results)
    .values(
      toInsert.map((r) => ({
        matchId: r.matchId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        winnerSide: r.winnerSide,
        enteredBy: null,
        updatedAt: new Date(),
      })),
    )
    .onConflictDoNothing();

  console.log(`✓ Inserted ${toInsert.length} results:`);
  toInsert.forEach((r) =>
    console.log(`  match #${r.matchId} → ${r.homeScore}–${r.awayScore}${r.winnerSide ? ` (${r.winnerSide})` : ""}`),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
