# Quiniela Mundial 2026 — Plan de implementación

## Objetivo
Construir la app aprobada en `docs/superpowers/specs/2026-06-11-quiniela-mundial-2026-design.md`: Next.js 16 fullstack + Drizzle/Neon + JWT propio, motor de torneo puro y UI móvil-first por tabs.

## Tareas

- [x] **1. Scaffold**: `npx create-next-app@latest` (TS, Tailwind, App Router, `src/`) + instalar `drizzle-orm @neondatabase/serverless jose bcryptjs zod` y dev `drizzle-kit vitest`
  → Verificar: `npm run dev` sirve la home; `npx vitest run` corre (sin tests aún).
- [x] **2. Datos oficiales** (búsqueda web): 48 equipos finales (con repechajes de marzo 2026), los 104 partidos (nº oficial, fase, grupo, kickoff UTC, sede), sources del cuadro R32 ("A1", "3CEFH", "W73") y tabla FIFA de asignación de terceros
  → Verificar: `src/lib/db/seed-data.ts` cuadra: 48 equipos, 12 grupos × 6 partidos = 72 + 32 de llaves = 104.
- [ ] **3. Schema + seed**: las 6 tablas del spec en Drizzle, cliente Neon, `db:push` y `db:seed` idempotente
  → Verificar: contra la instancia Neon, `teams`=48 y `matches`=104. ⚠️ Aquí pido a José las creds (`DATABASE_URL`); hasta entonces todo debe compilar sin DB.
- [ ] **4. Motor `lib/tournament/`** (puro, sin I/O): `computeStandings`, `rankThirds`, `buildBracket`, `propagateKnockout`, `scoreUser` + unit tests de desempates, duelo directo, ranking de terceros, asignación de llaves y scoring (grupos + avance)
  → Verificar: `npx vitest run` verde con casos borde cubiertos.
- [ ] **5. Auth JWT**: `lib/auth` (jose HS256, cookie `session` httpOnly, bcryptjs cost 10), actions `register/login/logout`, `middleware.ts`, páginas `/login` y `/registro`
  → Verificar: registro crea cookie y entra a `/quiniela`; sin cookie redirige a `/login`; `ADMIN_EMAIL` queda admin.
- [ ] **6. Actions de datos**: upsert de pronóstico (userId del JWT, lock server-side, `winner_side` obligatorio en empate de llave) + admin (results, `open_override`, `knockout_overrides`)
  → Verificar: tests — editar pronóstico ajeno, partido bloqueado y action admin sin claim son rechazados.
- [ ] **7. UI `/quiniela`**: tabs por fase; grupos A–L con mini-tabla viva + 6 tarjetas con autosave y candados; progreso X/72; llaves habilitadas al completar 72, con selector de avance en empates
  → Verificar: en viewport móvil, llenar un grupo recalcula su tabla al instante y el autosave marca "✓".
- [ ] **8. UI `/bracket` + `/tabla`**: bracket gráfico solo lectura con toggle Mi/Real; leaderboard (grupos + avance + total) con vista de quiniela ajena solo en partidos bloqueados
  → Verificar: con results de prueba, la tabla suma según spec §2 y el bracket real se pinta.
- [ ] **9. UI `/admin/resultados`**: captura cronológica, desbloqueo por partido, overrides de cruces
  → Verificar: cargar un resultado como admin actualiza `/tabla`; como no-admin la ruta no entra.
- [ ] **10. Verificación final**: `npm run lint && npm run build && npx vitest run`, seed completo, smoke manual (registro → 72 picks → bracket → admin carga → puntos) y deploy a Vercel
  → Verificar: build limpio y flujo entero funcionando con datos reales.

## Listo cuando
- [ ] Un amigo puede: registrarse, pronosticar los 104 partidos, ver su bracket formarse y ver la tabla con puntos calculados contra resultados reales.
- [ ] `npm run build` + `npx vitest run` limpios; desplegable a Vercel con `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`.

## Notas
- Las reglas finas (puntaje, locks, anti-copia, desempates deterministas) viven en el spec §2 — fuente de verdad.
- Neon: José crea la instancia y pasa las creds (necesarias desde la tarea 3); `JWT_SECRET` se genera local.
- El orden importa: el motor (4) va antes que la UI (7–8) porque ésta lo consume; 5 y 6 desbloquean 7–9.
