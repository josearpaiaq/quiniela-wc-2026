# Pronósticos de todos por partido — Diseño

**Fecha:** 2026-06-11
**Estado:** Aprobado

## Objetivo

Permitir que un usuario vea los pronósticos de todos los participantes para un
partido específico, una vez que el partido está bloqueado (regla anti-copia).

## Ruta y acceso

- Nueva página `src/app/(app)/partido/[matchId]/page.tsx`: server component,
  `export const dynamic = "force-dynamic"`, protegida con `requireUser()`.
- En `src/app/(app)/quiniela/quiniela-client.tsx`, cada partido **bloqueado**
  (según `isMatchOpen`) envuelve su card en un `Link` a `/partido/[id]`.
  Los partidos abiertos no enlazan: no hay nada que ver por la regla anti-copia.

## Regla anti-copia

La página valida en el servidor con `isPredictionVisibleToOthers`
(`src/lib/rules.ts`). Si el partido sigue abierto — incluido el caso de
`openOverride` activo, que puede reabrir un partido ya iniciado — no se
muestran pronósticos ajenos; en su lugar se muestra el mensaje
"Los pronósticos se revelan cuando el partido cierra".

## Datos

Consultas en paralelo:

1. El match desde `MATCHES` (seed-data); si el id no existe → `notFound()`.
2. Todas las `predictions` del match con join a `users`
   (displayName, firstName, lastName).
3. El `result` del match, si existe.
4. `knockoutOverrides`, para resolver los equipos del slot en fase eliminatoria.
5. `matches.openOverride` del partido, para evaluar el lock real.

## Contenido

- **Cabecera:** `P{id}`, equipos con `TeamLabel`, fecha con `formatKickoff`,
  y el resultado real si ya está cargado. Link "← Volver a la quiniela".
- **Lista de pronósticos:** una fila por usuario con:
  - `displayName (firstName lastName)` — el nombre enlaza a `/tabla/[userId]`.
  - Su marcador pronosticado; en eliminatoria con empate, quién avanza en
    penales.
  - Badge de puntos (+3 exacto / +1 acierto / +0) con los mismos estilos que
    `/tabla/[userId]`, solo cuando hay resultado.
- **Orden:** puntos descendente, luego displayName.
- Los usuarios sin pronóstico aparecen al final con "—".

## Puntos

Se calculan con la lógica existente de `src/lib/tournament/scoring.ts`
(mismo criterio que `groupPointsByMatch`); no se agrega lógica de negocio
nueva. En eliminatoria, el slot de equipos mostrado es el **real**
(resultados + overrides), no el bracket personal de cada usuario, porque la
vista compara un mismo partido.

## Errores

- `matchId` inválido → `notFound()`.
- Sin sesión → redirect existente de `requireUser()`.

## Testing

La lógica nueva es composición de piezas ya testeadas
(`isPredictionVisibleToOthers`, scoring). Si se extrae un helper de
ordenamiento/puntos por partido, se le agrega test en vitest; la página en sí
no lleva test.
