# Battle Mode — Design

**Date:** 2026-07-14
**Status:** Approved

## Context

Quiniela app for the 2026 World Cup, running on Vercel Hobby + Neon (serverless Postgres) + Drizzle + Next.js 16 (`cacheComponents` enabled). Current usage sits near Hobby limits (Fluid Active CPU at 78%, ISR Writes at 78%), so the feature must be designed around those constraints:

- Clicks must be batched client-side — never one request per click.
- The live scoreboard must be served from the Vercel CDN via `Cache-Control` headers (Edge Cache), **never** via ISR/`revalidatePath` (Data Cache), which would blow the ISR Writes limit.

## What it is

A per-match "battle": while a match's battle is open, any logged-in user can spam-click one of the two teams to give it points. Everyone sees the two global totals move in near real time. Pure hype feature — battle points do not affect quiniela scoring.

### Decisions (from brainstorming)

| Question | Decision |
| --- | --- |
| Tied to | Real World Cup matches, one battle per match |
| Scope | Global — one counter pair per match, shared by all users |
| Click mechanic | Free spamming, with a server-side technical cap to stop bots (max 15 clicks per flush, min 2.5 s between flushes per user) |
| Display | Team totals + percentage bar only. No leaderboard, no per-user display |
| Which matches | Automatic for every match whose slot teams are both defined; no admin toggle |
| Window | Opens as soon as both teams are known; closes at `kickoffAt + 3h` (covers extra time + penalties). Frozen totals stay visible after close |
| UI location | Section inside the existing `/partido/[matchId]` page |

## Data model

New table in `src/lib/db/schema.ts` (one row per user per match — exists for rate limiting, not for display):

```ts
export const battleClicks = pgTable(
  "battle_clicks",
  {
    matchId: smallint("match_id").notNull().references(() => matches.id),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    homeClicks: integer("home_clicks").notNull().default(0), // integer: a dedicated fan can exceed smallint's 32k
    awayClicks: integer("away_clicks").notNull().default(0),
    lastFlushAt: timestamp("last_flush_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId] })],
);
```

Team totals are `SUM(home_clicks)` / `SUM(away_clicks)` grouped by match — tens of rows per match, trivial for Neon.

## Battle rules (`src/lib/battle/rules.ts`)

Pure, unit-tested functions:

- `isBattleOpen({ kickoffAt, slot, now })` → both slot teams non-null **and** `now < kickoffAt + 3h`.
  - Group matches: teams come from seed data.
  - Knockout matches: slot resolved with the existing `buildBracket(results, overrides)`.
- Body validation bounds: `home ≥ 0`, `away ≥ 0`, `1 ≤ home + away ≤ 15`, integers (zod).
- `FLUSH_MIN_INTERVAL = 2.5 s`, `MAX_CLICKS_PER_FLUSH = 15` (≈ 6 clicks/s sustained — above human spam rate, so no human ever hits the cap; scripts do).

## API

### `POST /api/battle/[matchId]`

Body: `{ home: number, away: number }` — the client's accumulated clicks since last flush.

1. Authenticate via session cookie (existing JWT helpers). 401 otherwise.
2. Validate body with zod (bounds above). 400 otherwise.
3. Recompute `isBattleOpen` server-side (including bracket resolution, so nobody votes an undefined future match via curl). 409 if closed, 404 if unknown match.
4. Single atomic upsert = increment **and** rate limit in one statement:

   ```sql
   INSERT INTO battle_clicks (match_id, user_id, home_clicks, away_clicks, last_flush_at)
   VALUES ($matchId, $userId, $home, $away, now())
   ON CONFLICT (match_id, user_id) DO UPDATE
     SET home_clicks = battle_clicks.home_clicks + excluded.home_clicks,
         away_clicks = battle_clicks.away_clicks + excluded.away_clicks,
         last_flush_at = now()
     WHERE battle_clicks.last_flush_at < now() - interval '2.5 seconds'
   ```

   No row affected → too-frequent flush (bot): respond `{ accepted: false, home, away }` with HTTP 200. No error; the client just retries next tick. Concurrent requests cannot double-spend because the check lives inside the statement.
5. Respond `{ accepted: true, home, away }` (fresh totals) with `Cache-Control: no-store`. **Active clickers never poll** — their flush response is their scoreboard update.

### `GET /api/battle/[matchId]`

Returns `{ home, away, users }` — `users` is the per-user breakdown (`{ userId, name, home, away }`, sorted by total desc) that feeds the collapsible list; totals and breakdown come from one joined query. Served with:

```
Cache-Control: public, s-maxage=2, stale-while-revalidate=5
```

- Cached by the Vercel CDN (Edge Cache): any number of concurrent viewers costs at most ~1 function invocation per 2 s. Zero ISR Writes.
- Response contains no per-user data, so a shared cache entry is safe.
- Auth: `src/proxy.ts`'s matcher already covers `/api/battle/*`; the proxy runs before the CDN cache, so unauthenticated requests are redirected and cache HITs don't invoke the function.

## Client — `BattleArena` (`src/components/battle-arena.tsx`)

Rendered by the `/partido/[matchId]` RSC between the match header and the predictions section. Props: `matchId`, home/away team codes, `kickoffAt`, `open`, and initial totals (one extra `SUM` in the page's existing `Promise.all` — no loading flash).

State per side: `serverTotals` (last server response) + `pending` (unsent local clicks). Displayed total = `serverTotals + pending`, so the counter moves instantly on tap.

**Flush loop** — every 3 s, only when `pending > 0`:
- Send up to 15 clicks **total across both sides**; the remainder stays queued for the next tick.
- Success → `serverTotals = response`, subtract what was sent from `pending`.
- `accepted: false` or network error → keep `pending` intact, retry next tick. Clicks are never lost to transient failures.
- `pending` capped at 50 (console scripts can't queue unbounded clicks).

**Poll loop** — viewers only:
- Runs only while: battle open **and** tab visible (`visibilitychange`) **and** no flush happened in the last 3 s.
- Every 3 s during the match window; every 15 s before kickoff (battle open, match not started).
- Battle closed: no loops at all; server-rendered frozen totals.

**UI** (match existing style: `pitch-900` cards, `volt-400` accent, `font-mono` numerals):
- Two large tappable team buttons (flag + code like `TeamLabel`), sized for mobile thumb-spamming, with a scale micro-animation per tap.
- Animated percentage bar between them, colored with dedicated `battle-home`/`battle-away` theme tokens (lime vs sky on dark, blue vs amber on light — volt/gold were near-identical blues in light mode; pairs validated for CVD + contrast) and a 2px gap between segments.
- Collapsible "Clicks por usuario" list (closed by default): per-user click counts for each team, viewer's row first and sticky like the predictions list. Data rides along on every GET/POST response; first expand fetches once if nothing is loaded yet.
- Closed state: final bar + "Battle terminado" badge highlighting the winning side.
- Entry point: the quiniela match card shows a "Battle abierto" link to `/partido/[matchId]` while the battle is open pre-kickoff (post-kickoff the existing "Pronósticos" link covers it).

(UI copy is in Spanish like the rest of the app; code and identifiers in English.)

## Error handling

- Server: zod validation (400), auth (401), unknown match (404), closed battle (409). Rate-limited flush is a soft `accepted: false`, not an error.
- Client: transient failures merge clicks back into `pending`; no error UI needed beyond the counter simply not advancing server-side until the next successful flush.

## Testing

`src/lib/battle/rules.test.ts` (vitest, same pattern as existing `src/lib/*.test.ts`):

- `isBattleOpen`: undefined slot teams, before/after `kickoffAt + 3h` boundary.
- Body validation bounds (0 total, 15, 16, negatives, non-integers).
- Pure pending/flush merge logic (extracted from the component): optimistic display, partial send, failure re-merge, 50 cap.

Route handlers and CDN caching verified manually on a preview deploy.

## Budget check (Vercel Hobby, rolling 30-day window)

Estimates for one big battle (~40 active users, the final):

| Resource | Per big battle | Headroom at design time |
| --- | --- | --- |
| Function invocations | ~15–20K (flushes + CDN misses) | 424K |
| Fluid Active CPU | ~8–12 min | ~53 min |
| Edge requests | ~30–50K (polls served by CDN) | 408K |
| ISR writes | 0 | at 78%, the tight one |
| Neon writes | 1 upsert per flush (~6–7K) | trivial |

Remaining schedule is 4 matches (two semifinals, third place, final) — fits. Hobby limits use a **rolling 30-day window** (no fixed reset date): June's heavy usage falls out of the window day by day, so headroom keeps recovering through the final on July 19.

## Out of scope

- Per-user leaderboard / "top fans" (data supports it later if wanted).
- Admin controls for battles.
- WebSockets or external realtime services.
- Any effect on quiniela scoring.
