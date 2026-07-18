# Cierre de batalla al capturar el marcador real

Spec: `docs/superpowers/specs/2026-07-18-battle-close-on-result-design.md`

## Goal
Si el partido ya tiene resultado real en `results`, la batalla queda cerrada aunque no hayan pasado las 3h post-kickoff.

## Tasks
- [x] Task 1: Add `hasResult` cases to `src/lib/battle/rules.test.ts` → Verified: `npm run test` failed (no impl yet)
- [x] Task 2: Implement `hasResult` in `isBattleOpen` (`src/lib/battle/rules.ts`) → Verified: `npm run test` 67/67
- [x] Task 3: `POST /api/battle/[matchId]` — fetch `results` once for all phases, pass `hasResult`; 409 when result exists → Verified: build green
- [x] Task 4: `partido/[matchId]/page.tsx` — pass `hasResult: real !== undefined` → Verified: build green
- [x] Task 5: `quiniela-client.tsx` — pass `hasResult` in `renderCard` → Verified: build green
- [x] Task 6: `battle-arena.tsx` — flush 409 closes arena and drops pending clicks → Verified: 409 branch returns before the re-queue path
- [x] Task 7: Full verification — `npm run test` 67/67, lint (3 pre-existing errors elsewhere, none in touched files), build green

## Done When
- [x] Tests, lint and build green
- [x] Battle closed (server 409 + frozen UI) as soon as the real score is captured

## Verification notes
- E2E POST-409 check not run: the proxy gates `/api` behind a real session and
  minting a test JWT was blocked by the sandbox. Covered by unit tests + build;
  manual check: open a `/partido/<id>` with captured result → arena frozen/hidden.

## Notes
- AGENTS.md: skim `node_modules/next/dist/docs/` route-handler guide before Task 3.
- No commits — semantic commit split suggested to José at the end.
