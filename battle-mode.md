# Battle Mode

Spec: `docs/superpowers/specs/2026-07-14-battle-mode-design.md`

## Goal
Per-match click battle: batched clicks to Neon, CDN-cached scoreboard, arena inside `/partido/[matchId]`.

## Tasks
- [x] Task 1: Add `battleClicks` table to `src/lib/db/schema.ts`, run `npm run db:push` → Verify: push output shows `battle_clicks` created
- [x] Task 2: Write `src/lib/battle/rules.test.ts` (isBattleOpen window/slot cases, body bounds, pending/flush merge) → Verify: `npm run test` fails (no impl yet)
- [x] Task 3: Implement `src/lib/battle/rules.ts` (isBattleOpen, zod body schema, constants, merge helpers) → Verify: `npm run test` passes (57/57)
- [x] Task 4: `POST /api/battle/[matchId]` — auth, validate, server-side open check via `buildBracket`, atomic upsert with 2.5s rate-limit, return totals `no-store` → Verified: curl → `accepted: true` + totals; immediate retry → `accepted: false`; 3s later → accepted, cumulative
- [x] Task 5: `GET /api/battle/[matchId]` — SUM totals, `Cache-Control: public, s-maxage=2, stale-while-revalidate=5` → Verified: `curl -i` shows header + `{home, away}`
- [x] Task 6: `src/components/battle-arena.tsx` — optimistic counters, 3s flush loop (≤15/batch, retry on failure, cap 50), poll loop (3s live / 15s pre-kickoff, paused on hidden tab or recent flush), team buttons + percentage bar, closed state
- [x] Task 7: Integrate in `/partido/[matchId]/page.tsx` — totals SUM in existing `Promise.all`, compute `open` from slot + kickoff, render arena section → Verified: arena SSR'd on `/partido/102` (ARG vs ENG, "En vivo", both buttons)
- [x] Task 8: Full verification — tests 57/57, lint clean on new files (3 pre-existing errors elsewhere), build green; API exercised end-to-end vs dev server (200/409/400/307 cases), test rows deleted afterwards

## Done When
- [x] Tests, lint and build green
- [x] API verified end-to-end with a real session (flush, rate limit, closed battle, auth gate)
- [x] No `revalidatePath`/ISR usage anywhere in the feature

## Notes
- Read `node_modules/next/dist/docs/` guides (route handlers, dynamic APIs) before Tasks 4-7 (AGENTS.md).
- No commits — semantic commit split suggested to José at the end.
