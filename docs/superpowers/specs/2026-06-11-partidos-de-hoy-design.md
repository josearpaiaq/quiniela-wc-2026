# Sección "Partidos de hoy" — Diseño

**Fecha:** 2026-06-11
**Estado:** Aprobado

## Objetivo

Mostrar al inicio de la quiniela todos los partidos del día, con las mismas
cards interactivas del resto de la página.

## Ubicación y cálculo

- Sección nueva en `src/app/(app)/quiniela/quiniela-client.tsx`, entre la
  franja de progreso y los paneles de fase; visible en cualquier tab.
- "Hoy" se calcula en el navegador con la zona horaria local del usuario
  (consistente con `formatKickoff`): un partido es de hoy si su `kickoffAt`
  cae en el mismo día calendario local que el `now` capturado al montar.

## Contenido

- Encabezado "Hoy · {n} partido(s)".
- Cards completas reutilizando el `renderCard` existente, ordenadas por hora
  de kickoff. Esto da: edición inline si el partido sigue abierto; candado,
  resultado, puntos y link "Ver pronósticos de todos" si ya cerró; equipos de
  eliminatoria desde el bracket propio, como en el resto de la quiniela.

## Estado vacío

Si no hay partidos hoy, la sección no se renderiza (sin placeholder).

## Lógica extraída

Helper puro `isSameLocalDay(a: Date, b: Date)` en `src/lib/format.ts`, con
test en vitest; el componente solo lo consume.

## Sin cambios de servidor

La página ya carga predicciones y resultados de todos los partidos; no hay
queries nuevas.

## Detalle de implementación

Las cards de hoy se renderizan duplicadas respecto a su grupo/fase (mismo
`match.id` en dos listas distintas). React lo permite por ser listas
separadas; `saveStatus` es compartido, así que editar en "Hoy" se refleja
igual en la card de su grupo.
