# Cierre de batalla al capturar el marcador real

**Fecha:** 2026-07-18
**Estado:** Aprobado

## Problema

La batalla cierra únicamente 3 horas después del kickoff (`BATTLE_CLOSE_AFTER_KICKOFF_MS`).
Si el admin captura el marcador real antes de ese límite (p. ej. un partido de grupos que
termina a los ~110 min), la batalla sigue aceptando clicks sobre un partido ya decidido.

## Regla

Un partido con resultado real capturado en `results` tiene la batalla **cerrada**, aunque
no hayan pasado las 3 horas. El límite de 3h se mantiene como cierre de respaldo cuando
el resultado aún no se captura.

## Cambios

### 1. `src/lib/battle/rules.ts`

`isBattleOpen` recibe un campo nuevo en su argumento `battle`:

```ts
isBattleOpen({ kickoffAt, slot, hasResult }, now)
```

- `hasResult: boolean` — `true` cuando `results` ya tiene fila para el partido.
- Si `hasResult` es `true`, devuelve `false` sin mirar la ventana de 3h.

### 2. `POST /api/battle/[matchId]` (`route.ts`)

- Hoy solo consulta `results` para partidos knockout (dentro de `resolveSlot`). Se
  reestructura para consultar `results` una sola vez en todas las fases: sirve tanto
  para derivar el slot (knockout) como para el check `results.get(matchId)`.
- Pasa `hasResult` a `isBattleOpen`; si la batalla está cerrada responde `409` con el
  mensaje existente. El servidor sigue siendo la autoridad.

### 3. `src/app/(app)/partido/[matchId]/page.tsx`

Ya carga `real = results.get(matchId)`. Pasa `hasResult: real !== undefined` a
`isBattleOpen`. La arena se renderiza congelada ("Batalla terminada") vía el prop
`open` existente; `showBattle` no cambia (una batalla con clicks sigue visible).

### 4. `src/app/(app)/quiniela/quiniela-client.tsx`

Ya tiene `real = results[match.id]` en `renderCard`. Pasa `hasResult` igual que arriba;
el `battleHref` del match card desaparece cuando hay resultado.

### 5. `src/components/battle-arena.tsx`

Si un flush recibe `409` (el resultado se capturó mientras el usuario tenía la arena
abierta), la arena se cierra: `setClosed(true)` y descarta los clicks pendientes, en
lugar de reintentarlos cada 3s hasta que venza la ventana de 3h. Otros errores siguen
reintentando como hoy.

## Pruebas

En `rules.test.ts`:

- `hasResult: true` dentro de la ventana de 3h → cerrada.
- `hasResult: false` dentro de la ventana → abierta (comportamiento actual intacto).
- Los casos existentes se actualizan con `hasResult: false`.

Verificación manual: build + tests verdes; POST con resultado capturado responde 409.

## Fuera de alcance

- No se toca el scoring (`battleWinnerOf`, puntos extra).
- No se notifica en vivo a la arena cuando se captura el resultado (el poll de totales
  no trae ese dato); el cierre llega vía el 409 del siguiente flush o al recargar.
