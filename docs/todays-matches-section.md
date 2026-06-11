# Sección "Partidos de hoy"

Spec: `docs/superpowers/specs/2026-06-11-partidos-de-hoy-design.md`

## Goal

Sección al inicio de /quiniela con las cards de los partidos del día (zona
horaria local del usuario).

## Tasks

- [x] 1. Agregar helper `isSameLocalDay(a: Date, b: Date): boolean` en
      `src/lib/format.ts` → Verify: test nuevo en vitest (crear
      `src/lib/format.test.ts`) cubre mismo día, día distinto y cruce de
      medianoche; `npx vitest run` en verde.
- [x] 2. En `quiniela-client.tsx`: `todayMatches = MATCHES.filter((m) =>
      isSameLocalDay(new Date(m.kickoffAt), new Date(now)))` ordenados por
      kickoff; sección "Hoy · {n}" con `renderCard` entre la franja de
      progreso y los paneles, oculta si está vacía → Verify:
      `npx tsc --noEmit` sin errores.
- [x] 3. Verificación manual: `npm run dev`, abrir /quiniela con sesión y ver
      la sección con los partidos del 11 jun; confirmar que editar un
      pronóstico desde "Hoy" actualiza también la card en su grupo.

## Done When

- [x] /quiniela muestra arriba los partidos de hoy (hora local), editables si
      siguen abiertos, y la sección desaparece los días sin partidos.
- [x] Tests y typecheck en verde.
