import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getWCFinishedMatches } from "@/lib/football-data-client";
import { getDb, schema } from "@/lib/db";
import { MATCHES } from "@/lib/db/seed-data";

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Normalize a kickoff ISO string to minute precision for matching
function kickoffKey(iso: string): string {
  return iso.slice(0, 16); // "2026-06-12T23:00"
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = utcDateString(now);
  const yesterday = utcDateString(new Date(now.getTime() - 86_400_000));

  const fdFinished = await getWCFinishedMatches(yesterday, today);

  // Build kickoff-time → seed match lookup
  const kickoffToSeedMatch = new Map<string, (typeof MATCHES)[0]>();
  for (const m of MATCHES) {
    kickoffToSeedMatch.set(kickoffKey(m.kickoffAt), m);
  }

  const db = getDb();

  // Fetch existing final results so we never overwrite a human-entered result
  const existingResults = await db
    .select({ matchId: schema.results.matchId })
    .from(schema.results);
  const enteredMatchIds = new Set(existingResults.map((r) => r.matchId));

  // ── FINAL RESULTS ─────────────────────────────────────────────────────────

  const toInsert: {
    matchId: number;
    homeScore: number;
    awayScore: number;
    winnerSide: "home" | "away" | null;
  }[] = [];
  const skipped: number[] = [];
  const unmatched: { fdId: number; utcDate: string; home: string; away: string }[] = [];

  for (const fd of fdFinished) {
    const ourMatch = kickoffToSeedMatch.get(kickoffKey(fd.utcDate));

    if (!ourMatch) {
      unmatched.push({
        fdId: fd.id,
        utcDate: fd.utcDate,
        home: fd.homeTeam.tla,
        away: fd.awayTeam.tla,
      });
      continue;
    }

    if (enteredMatchIds.has(ourMatch.id)) {
      skipped.push(ourMatch.id);
      continue;
    }

    const { fullTime, extraTime, penalties, winner } = fd.score;

    const homeScore = extraTime?.home ?? fullTime.home;
    const awayScore = extraTime?.away ?? fullTime.away;
    if (homeScore === null || awayScore === null) continue;

    let winnerSide: "home" | "away" | null = null;
    if (ourMatch.phase !== "group" && penalties?.home !== null) {
      winnerSide = winner === "HOME_TEAM" ? "home" : "away";
    }

    toInsert.push({ matchId: ourMatch.id, homeScore, awayScore, winnerSide });
  }

  if (toInsert.length > 0) {
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

    revalidatePath("/quiniela");
    revalidatePath("/bracket");
    revalidatePath("/tabla");
    revalidatePath("/admin/resultados");
    revalidatePath("/partido", "layout");
  }

  return Response.json({
    synced: toInsert.length,
    skipped: skipped.length,
    unmatched: unmatched.length,
    ...(unmatched.length > 0 && { unmatchedDetails: unmatched }),
  });
}
