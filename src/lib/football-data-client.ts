const BASE = "https://api.football-data.org/v4";

export interface FDScore {
  home: number | null;
  away: number | null;
}

export interface FDMatch {
  id: number;
  utcDate: string; // ISO 8601, e.g. "2026-06-12T23:00:00Z"
  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "POSTPONED"
    | "SUSPENDED"
    | "CANCELLED";
  homeTeam: { id: number; tla: string; shortName: string };
  awayTeam: { id: number; tla: string; shortName: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: FDScore;
    extraTime: FDScore;
    penalties: FDScore;
  };
}

interface FDMatchesResponse {
  matches: FDMatch[];
}

// Fetch finished WC 2026 matches for a date range (UTC dates, "YYYY-MM-DD")
export async function getWCFinishedMatches(
  dateFrom: string,
  dateTo: string,
): Promise<FDMatch[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY not configured");

  const url = `${BASE}/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=FINISHED`;
  const res = await fetch(url, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org ${res.status}: ${body}`);
  }

  const data: FDMatchesResponse = await res.json();
  return data.matches ?? [];
}
