# Pronósticos de todos por partido

Spec: `docs/superpowers/specs/2026-06-11-pronosticos-por-partido-design.md`

## Goal

Página `/partido/[matchId]` que muestra el pronóstico de todos los usuarios
para un partido bloqueado, enlazada desde la quiniela.

## Tasks

- [x] 1. Leer la guía de rutas dinámicas/params en `node_modules/next/dist/docs/`
      (esta versión de Next.js tiene breaking changes) → Verify: confirmar la
      convención vigente de `params` antes de escribir la página.
- [x] 2. Extraer helper `groupMatchPoints(predicted, real): 3 | 1 | 0` en
      `src/lib/tournament/scoring.ts`; usarlo dentro de `scoreUser` y
      reemplazar el duplicado `groupOutcomePoints` de
      `src/app/(app)/quiniela/quiniela-client.tsx` → Verify: `npx vitest run`
      pasa con un test nuevo del helper en `scoring.test.ts`.
- [x] 3. Crear `src/app/(app)/partido/[matchId]/page.tsx`:
      - `force-dynamic`, `requireUser()`; matchId fuera de `MATCHES` → `notFound()`.
      - Queries en paralelo: `matches.openOverride` del partido, `predictions`
        del match join `users` (displayName, firstName, lastName), todos los
        `users`, `results`, `knockoutOverrides`.
      - Si `isMatchOpen` (anti-copia) → solo cabecera + mensaje
        "Los pronósticos se revelan cuando el partido cierra".
      - Cabecera: tag P{id}, `TeamLabel` × 2 (slot real: seed para grupos,
        `buildBracket(results, overrides)` para eliminatoria), `formatKickoff`,
        resultado real si existe, link "← Volver a la quiniela".
      - Filas: `displayName (firstName lastName)` con link a `/tabla/[userId]`,
        marcador pronosticado, penales si empate en eliminatoria, badge
        +3/+1/+0 vía `groupMatchPoints` (solo fase de grupos, solo con
        resultado). Orden: puntos desc, luego displayName; sin pronóstico al
        final con "—".
      → Verify: `npx tsc --noEmit` (o build) sin errores.
- [x] 4. `MatchCard`: prop opcional `detailsHref?: string`; cuando la card está
      bloqueada renderiza link "Ver pronósticos de todos →" en el footer.
      En `renderCard` de `quiniela-client.tsx` pasar
      `detailsHref={open ? undefined : `/partido/${match.id}`}`
      → Verify: cards abiertas sin link, bloqueadas con link.
- [x] 5. Verificación final: `npx vitest run` + `npm run dev`; abrir
      `/partido/[id]` de un partido bloqueado (lista visible y ordenada), de
      uno abierto (mensaje anti-copia) y un id inválido (404).

## Done When

- [x] Un partido bloqueado en la quiniela enlaza a `/partido/[id]` con los
      pronósticos de todos, ordenados por puntos, con formato
      `displayName (firstName lastName)`.
- [x] Un partido abierto nunca revela pronósticos ajenos (incluido `openOverride`).
- [x] Tests y typecheck en verde.
