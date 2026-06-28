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

async function fetchWCMatches(
  dateFrom: string,
  dateTo: string,
  status?: string,
): Promise<FDMatch[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY not configured");

  const params = new URLSearchParams({ dateFrom, dateTo });
  if (status) params.set("status", status);
  const url = `${BASE}/competitions/WC/matches?${params}`;
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

export async function getWCFinishedMatches(
  dateFrom: string,
  dateTo: string,
): Promise<FDMatch[]> {
  return fetchWCMatches(dateFrom, dateTo, "FINISHED");
}

export async function getWCKnockoutMatches(): Promise<FDMatch[]> {
  return fetchWCMatches("2026-06-28", "2026-07-19");
}
