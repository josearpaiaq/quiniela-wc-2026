# Tabla de grupos con resultados reales

**Fecha:** 2026-06-12
**Estado:** aprobado

## Problema

En la página de Quiniela, la tabla de posiciones de cada grupo se calcula solo
con las predicciones del usuario. No hay forma de ver la tabla real del grupo
con los resultados reales cargados por el admin (el Bracket sí tiene un toggle
"Mi bracket / Real", pero los grupos no).

## Diseño

Toggle segmentado **"Tu quiniela / Real"** en el panel de grupos de la
Quiniela, encima de la tabla de posiciones, con el mismo estilo que el toggle
del Bracket (`bracket-view.tsx`).

- **Estado:** local en `GroupsPanel` (`"mine" | "real"`), default `"mine"`.
- **Datos:** `QuinielaClient` ya recibe `results` del servidor; se convierte
  con `toScoreMap` y se pasa a `GroupsPanel` como `realScoreMap`.
- **Cálculo:** la tabla usa `computeGroupStandings(group, mapa)` — la misma
  función ya existente — alimentada con predicciones o resultados reales
  según el toggle.
- **Encabezado:** "Grupo X · según tu quiniela" / "Grupo X · resultados
  reales".
- **Caso vacío:** si el grupo no tiene ningún resultado real, se muestra una
  nota "Aún no hay resultados reales en este grupo" (la tabla muestra ceros,
  igual que una quiniela sin llenar).
- **Sin cambios** en las tarjetas de partido: ya muestran el marcador real
  junto a la predicción.

## Alcance

Un solo archivo: `src/app/(app)/quiniela/quiniela-client.tsx`.

## Tests

No se requieren nuevos: el cálculo está cubierto por `standings.test.ts`;
esto es solo wiring de UI.
