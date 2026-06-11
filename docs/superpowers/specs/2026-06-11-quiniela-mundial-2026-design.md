# Quiniela Mundial 2026 — Diseño

- **Fecha**: 2026-06-11
- **Estado**: Aprobado por José en sesión de brainstorming
- **Contexto**: el Mundial 2026 inicia el 11 de junio de 2026 (hoy); la app debe salir en días.

## 1. Propósito

Quiniela competitiva entre amigos para el Mundial 2026. Cada participante pronostica los 104 partidos; un admin captura los resultados reales; la app calcula puntos y muestra una tabla de posiciones. Cada usuario ve gráficamente todos los juegos por fase y su propio bracket de eliminación directa, que se forma a partir de sus pronósticos de fase de grupos.

## 2. Reglas del juego

### Formato del torneo
- 48 equipos, 12 grupos (A–L), 104 partidos: 72 de grupos, 16 de 32avos, 8 de 16avos, 4 cuartos, 2 semifinales, 3er puesto y final.
- Clasifican a 32avos: 1º y 2º de cada grupo (24) + los 8 mejores terceros.

### Pronósticos
- Cada usuario pronostica el marcador (enteros 0–99) de los 104 partidos.
- **Eliminatorias**: el bracket personal se habilita al completar los 72 pronósticos de grupos (los cruces se forman cuando los grupos están definidos). Si el pronóstico de una llave es empate, el usuario elige quién avanza (penales) con `winner_side`.
- Si el usuario edita un pronóstico de grupos aún desbloqueado, su bracket se recalcula. Los marcadores ya capturados en llaves se conservan **por posición del cuadro** (partidos 73–104): cambian los equipos mostrados, no los números ni el `winner_side` (que es relativo a local/visitante del slot).

### Puntaje
- **Fase de grupos** (comparación partido a partido contra el resultado real): marcador exacto **3 pts**; solo resultado correcto (local/empate/visitante) **1 pt**; lo demás 0.
- **Eliminatorias** (por avance, comparando el bracket del usuario contra el bracket real): por cada equipo correctamente colocado en una ronda real: 32avos **1**, 16avos **2**, cuartos **3**, semifinales **4**, final **6**, campeón **8**. Cuenta la **presencia del equipo en la ronda**, no el slot exacto.
- El partido por el 3er puesto se pronostica pero **no otorga puntos**.
- Máximo teórico: 216 (grupos) + 124 (avance) = 340 pts.

### Bloqueo y visibilidad
- Un pronóstico es editable mientras `now < kickoff_at` del partido real, **o** mientras el admin tenga activo `open_override` para ese partido (desbloqueo puntual para arranque tardío; sistema de honor para partidos ya jugados).
- Las llaves del bracket personal se bloquean con el `kickoff_at` del partido real correspondiente (slot 73–104).
- **Anti-copia**: los pronósticos de otro usuario para un partido son visibles solo cuando ese partido ya no es editable (`now >= kickoff_at` y sin override).
- Consecuencia explícita: si un partido de grupos se bloqueó sin pronóstico, solo el `open_override` del admin permite completarlo (y por tanto habilitar las llaves de ese usuario).

### Desempates (deterministas, sin sorteo)
- **Dentro de un grupo**: puntos → diferencia de gol → goles a favor → criterios recalculados solo entre los empatados (puntos, DG, GF en sus duelos directos) → `draw_position` (orden del sorteo, 1–4).
- **Ranking de terceros**: puntos → diferencia de gol → goles a favor → letra de grupo (alfabético).

### Bracket real
- Se deriva con el mismo motor que los brackets personales, pero a partir de los resultados del admin y los cruces oficiales FIFA (incluida la tabla oficial de asignación de mejores terceros).
- `knockout_overrides` permite al admin corregir manualmente los equipos de un cruce real si la derivación difiriera de lo oficial.

## 3. Stack y arquitectura

Next.js 15 (App Router, TypeScript) como fullstack + Tailwind CSS. Drizzle ORM sobre Neon Postgres (`@neondatabase/serverless`). Deploy en Vercel. Lecturas en Server Components; escrituras con Server Actions (sin capa REST).

```
src/
├── app/
│   ├── (auth)/login, registro/        # páginas públicas
│   ├── (app)/                         # protegido por sesión
│   │   ├── quiniela/                  # tabs por fase (pantalla principal)
│   │   ├── bracket/                   # bracket gráfico solo lectura
│   │   ├── tabla/                     # leaderboard
│   │   └── admin/resultados/          # captura de resultados (solo admin)
│   └── middleware.ts                  # verifica JWT en cada request
├── lib/
│   ├── auth/        # jose (JWT), bcryptjs, helpers de sesión
│   ├── db/          # schema Drizzle, cliente Neon, seed
│   ├── tournament/  # motor del torneo: funciones puras, sin I/O
│   └── actions/     # server actions: auth, pronósticos, resultados admin
```

## 4. Autenticación y autorización (JWT)

- Registro: email único + contraseña (≥ 8) + nombre + apellido + alias opcional. Hash con **bcryptjs cost 10**.
- Login → JWT firmado con **jose, HS256** (`JWT_SECRET` en env), expira 30 días, claims `{ sub: userId, name, admin }` → cookie `session`: `httpOnly`, `Secure` (prod), `SameSite=Lax`.
- `middleware.ts` verifica el token para todo `(app)/` y redirige a `/login`.
- **Defensa en profundidad**: cada server action vuelve a verificar el JWT y toma `userId` exclusivamente del token (nunca del payload del cliente) → un usuario solo puede modificar su propia información. Las actions de admin exigen el claim `admin`.
- El email igual a `ADMIN_EMAIL` (env) queda `is_admin = true` al registrarse.

## 5. Modelo de datos (Postgres / Drizzle)

| Tabla | Campos | Notas |
|---|---|---|
| `users` | `id` uuid PK, `email` unique, `password_hash`, `first_name`, `last_name`, `display_name`, `is_admin` bool, `created_at` | `display_name` por defecto: `"Nombre A."` |
| `teams` | `id` PK, `fifa_code` ("MEX"), `name` ("México"), `flag` (emoji), `group_letter` A–L, `draw_position` 1–4 | los 48 equipos, seed |
| `matches` | `id` PK = nº oficial 1–104, `phase` enum (`group,r32,r16,qf,sf,third,final`), `group_letter` nullable, `kickoff_at` timestamptz, `venue`, `home_team_id`/`away_team_id` FK nullable (solo grupos), `home_source`/`away_source` text ("A1", "3CEFH", "W73"), `open_override` bool | los 104 partidos, seed; `*_source` codifica el cuadro oficial |
| `predictions` | PK compuesta (`user_id` FK, `match_id` FK), `home_score`, `away_score` (0–99), `winner_side` enum (`home,away`) nullable, `updated_at` | `winner_side` obligatorio si empate en llave |
| `results` | `match_id` PK+FK, `home_score`, `away_score` (90 min), `winner_side` nullable (penales), `entered_by` FK, `updated_at` | 1-a-1 con `matches` |
| `knockout_overrides` | `match_id` PK+FK, `home_team_id` FK, `away_team_id` FK | corrección manual del bracket real |

**Nada derivado se almacena**: posiciones de grupos, terceros, brackets, puntos y leaderboard se calculan al vuelo con `lib/tournament/`. Con decenas de usuarios es despreciable; si creciera, se añade caché sin tocar el modelo.

## 6. Motor del torneo (`lib/tournament/`)

Funciones puras compartidas entre brackets personales y bracket real:

- `computeStandings(scores)` → tablas de los 12 grupos aplicando los desempates de la sección 2.
- `rankThirds(standings)` → los 8 mejores terceros.
- `buildBracket(qualified)` → asigna equipos a los 16 cruces de 32avos según `home_source`/`away_source` y la tabla oficial FIFA de terceros.
- `propagateKnockout(picks)` → llena 16avos → final a partir de marcadores y `winner_side` (incluido el 3er puesto, con los perdedores de semifinales).
- `scoreUser(predictions, results)` → desglose de puntos (grupos + avance por ronda).

**Datos oficiales**: el conocimiento del modelo llega a enero 2026 (incluye el sorteo de diciembre 2025). Durante la implementación se verificará con búsqueda web: los 6 clasificados de los repechajes de marzo 2026, el calendario final (horarios/sedes de los 104 partidos) y la **tabla oficial FIFA de asignación de terceros a llaves**. Si la tabla oficial no fuera codificable, se usará un emparejamiento determinista que respete las restricciones de grupo por slot, documentado como aproximación — el `knockout_overrides` cubre cualquier divergencia en el bracket real.

## 7. Pantallas (español, móvil primero)

1. **`/login` y `/registro`**.
2. **`/quiniela`** — tabs *Grupos · 32avos · 16avos · Cuartos · Semis · Final*.
   - Grupos: chips A–L; por grupo, mini-tabla en vivo + 6 tarjetas de partido con inputs. Progreso global (X/72), candado en bloqueados.
   - Llaves: tarjetas por ronda con los equipos del bracket propio; selector "¿quién avanza?" si hay empate. Deshabilitadas hasta completar 72, con barra de progreso.
   - **Autosave por partido** (guardar al cambiar, indicador "✓ guardado").
3. **`/bracket`** — bracket completo solo lectura con toggle **Mi bracket / Bracket real**.
4. **`/tabla`** — leaderboard (alias, pts grupos, pts avance, total); tap en un participante → su quiniela (solo partidos bloqueados).
5. **`/admin/resultados`** — captura cronológica de resultados, desbloqueo por partido (`open_override`), overrides de cruces.

## 8. Manejo de errores

- Validación con `zod` en cada server action (marcadores 0–99 enteros, email válido, contraseña ≥ 8, `winner_side` requerido en empates de llave).
- El servidor re-verifica el bloqueo al guardar; si el partido ya cerró → error "Este partido ya está bloqueado".
- Ownership: `user_id` del JWT, jamás del payload.
- Mensajes en español inline en formularios; `error.tsx` para fallos de conexión.

## 9. Testing

- **Vitest sobre `lib/tournament/`** (el grueso del esfuerzo): desempates (incluido duelo directo y fallback), ranking de terceros, asignación de llaves contra la tabla FIFA, propagación con empates/penales, scoring de grupos y avance. Fixtures con casos conocidos.
- Tests de actions críticas: no editar pronóstico ajeno, no guardar partido bloqueado, gate de admin.
- Sin e2e; smoke manual con seed + usuario demo.

## 10. Deploy y configuración

- Vercel + Neon. Variables: `DATABASE_URL` (José crea la instancia Neon y pasa las creds), `JWT_SECRET`, `ADMIN_EMAIL`.
- Migraciones con `drizzle-kit`; seed idempotente (`db:seed`) con equipos, partidos, horarios y cuadro oficial.
- `.gitignore`: `.env*`, `node_modules/`, `.next/`, `.superpowers/`.

## 11. Trabajo futuro (fuera de v1)

- **Toggle de vista**: bracket interactivo editable (mockup A) como alternativa a las tabs, a elección del usuario.
- Resultados automáticos vía API externa.
- Notificaciones/recordatorios de partidos por pronosticar.

## 12. Decisiones registradas

| Pregunta | Decisión |
|---|---|
| Modo de juego | Competitiva con puntos y tabla general |
| Resultados reales | Admin manual desde la app |
| Puntaje grupos | Exacto 3 / resultado 1 |
| Puntaje eliminatorias | Por avance (1/2/3/4/6/8), marcador de llaves solo define el avance propio |
| Bloqueo | Al kickoff de cada partido + override puntual de admin |
| Registro | Abierto (email + contraseña) |
| Stack | Next.js 15 Server Actions + JWT propio (jose) + Drizzle + Neon + Vercel |
| UI | Tabs por fase móvil-first (mockup B); bracket gráfico solo lectura |
| Usuario | `first_name` y `last_name` además de `display_name` |
