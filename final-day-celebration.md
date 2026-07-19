# Celebración del ganador de la quiniela + día de la final

Spec: `docs/superpowers/specs/2026-07-18-final-day-celebration-design.md`

## Goal
Card animado para el/los campeón(es) de cada grupo en `/tabla`, fuegos artificiales +
sonido al revelarse el ganador (repetibles con un botón), y un ticker "HOY ES LA FINAL"
en el header — listo antes de la final de mañana (2026-07-19).

## Tasks
- [x] Task 1: `src/lib/champion.ts` — `computeChampionIds(entries)` (empate real = mismo
  `total` y `exactos` que el primero) + `src/lib/champion.test.ts` (sin empate, empate
  total+exactos, empate solo en total no cuenta) → Verified: `npm run test` 4/4 nuevos, verde
- [x] Task 2: `globals.css` — keyframes `champion-border-shift`, `champion-crown-pulse`,
  `champion-shine`, `firework-burst`, `final-day-ticker-scroll` + clases
  `.champion-card`, `.champion-crown`, `.champion-ribbon`, `.champion-mini-confetti`
  (10 partículas con posiciones/colores/delays fijos, sin `Math.random()`) → Verified:
  `npm run build` compila sin error
- [x] Task 3: `src/lib/sound/fanfare.ts` — `playChampionFanfare()` con Web Audio API
  (arpegio corto, `AudioContext` singleton perezoso, guardado con `typeof window` +
  `try/catch`) → Verified: `npx tsc --noEmit` limpio
- [x] Task 4: `src/components/champion-fireworks.tsx` — `ChampionFireworksProvider` +
  `useChampionFireworks`, `FireworksBurst` (portal, 4 explosiones simultáneas,
  ~24-26 partículas c/u vía `Math.cos`/`Math.sin`, colores gold/volt/blanco),
  `ChampionAutoReveal` (gate por `localStorage["qm26:champion-seen:<groupId>"]`),
  `ChampionReplayButton` (`preventDefault`/`stopPropagation`) → Verified: `npm run lint` limpio
- [x] Task 5: Wire en `src/app/(app)/tabla/page.tsx` — `tournamentComplete =
  results.size === 104`, `championIds` vía `computeChampionIds`; envolver `<ol>` en
  `<ChampionFireworksProvider>`; montar `<ChampionAutoReveal groupId={selected.id}>`
  una sola vez; aplicar `.champion-card` + ícono `Medal` + `<ChampionReplayButton>` a
  cada `<li>` cuyo `user.id` esté en `championIds` → Verified: probado en navegador real
  (Chrome, sesión ya autenticada) forzando `tournamentComplete` con los datos reales de
  DEV (103/104 resultados) — card animado en dark/light y mobile/desktop, fuegos +
  sonido al entrar, replay por click sin navegar a `/tabla/[userId]`, override revertido
- [x] Task 6: `src/components/final-day-ticker.tsx` — detección por fecha (mismo
  criterio `localDateKey` que el Easter egg de Panamá, pero server-side ya que este
  componente hace fetch), resuelve finalistas con `buildBracket` cuando ya están
  definidos, fallback genérico si no → Verified: probado en navegador forzando la fecha
  — mostró "🏆 HOY ES LA FINAL DEL MUNDIAL — 🇪🇸 España vs Argentina 🇦🇷 — 🏆" con los
  finalistas reales ya resueltos en DEV; override revertido
- [x] Task 7: Montar `<FinalDayTicker />` en `src/app/(app)/layout.tsx` arriba del
  `<header>`, envuelto en `<Suspense>` (mismo patrón que `AdminNav`/`HeaderSession`) →
  Verified: header sticky intacto, ticker visible en mobile y desktop
- [x] Task 8: Verificación final → Verified: `npm run lint` sin errores nuevos (3
  errores/5 warnings preexistentes, ninguno en archivos tocados), `npm run test` 71/71,
  `npm run build` verde con Cache Components

## Done When
- [x] Tests, lint y build en verde
- [x] Card de campeón animado en `/tabla` cuando el torneo está cerrado, incluyendo
  empates reales (mismo total y exactos)
- [x] Fuegos artificiales + sonido se disparan una vez por usuario/grupo y son
  repetibles con el botón de replay sin romper la navegación existente
- [x] Ticker "HOY ES LA FINAL" visible el 2026-07-19 con los nombres reales de los
  finalistas

## Verification notes
- El DEV de `.env` resultó tener datos reales del torneo en curso (103/104 resultados,
  semifinales ya resueltas) — permitió probar ambas features con datos reales en vez de
  fixtures, en un navegador con sesión real ya autenticada (usuario "Pinturicchio").
  Todo el QA visual se hizo con overrides temporales en código (revertidos al final), sin
  tocar la base de datos.
- Bug encontrado y corregido durante el QA: el ribbon "CAMPEÓN" tapaba el desglose de
  puntos (`✓18`) y quedaba por encima del ícono de posición. Fix: el botón de replay
  ahora envuelve el ícono `Medal` (en vez de vivir como elemento aparte junto al score),
  y el card campeón gana padding extra arriba/derecha (`pt-6 pr-9` en vez de `py-3 px-4`)
  para darle aire al ribbon sin tapar texto.
- Gotcha real de Next 16 + Cache Components (confirma la advertencia de AGENTS.md): el
  build fallaba con `new Date()` usado antes de acceder a datos "uncached"/de request en
  un Server Component. Fix: `await connection()` (de `next/server`) antes del `new
  Date()` en `final-day-ticker.tsx` — ver
  `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`.

## Notes
- Sin commits — como siempre, no se commiteó nada automáticamente.
