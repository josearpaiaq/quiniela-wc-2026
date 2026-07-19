/**
 * Which leaderboard entries are tied for #1 on every numeric tiebreak
 * criterion (total, exactos) — only the alphabetical sort separated them.
 * `entries` must already be sorted the same way as the /tabla standings.
 */
export function computeChampionIds(
  entries: { id: string; total: number; exactos: number }[],
): Set<string> {
  if (entries.length === 0) return new Set();
  const [leader, ...rest] = entries;
  const tied = rest.filter((e) => e.total === leader.total && e.exactos === leader.exactos);
  return new Set([leader.id, ...tied.map((e) => e.id)]);
}
