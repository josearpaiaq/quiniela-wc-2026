# Quiniela Mundial 2026 — Arquitectura técnica a fondo

Documento de estudio: explica cada decisión técnica del proyecto, por qué se tomó, y qué
concepto general hay detrás. Está pensado para un desarrollador con experiencia en
React/Next que quiere entender el "por qué" además del "qué".

---

## 1. El stack y por qué cada pieza

| Pieza | Versión | Rol | Por qué esta y no otra |
|---|---|---|---|
| Next.js | 16.2.9 (App Router) | Framework full-stack | Server Components + Server Actions eliminan la necesidad de una API REST separada |
| React | 19.2 | UI | `useActionState`, form actions nativas |
| Drizzle ORM | 0.45 | Acceso a datos | SQL tipado sin codegen pesado; el schema TS es la única fuente de verdad |
| Neon (`@neondatabase/serverless`) | driver HTTP | Postgres serverless | Cada query es un fetch HTTP — ideal para funciones serverless, pero **sin transacciones** (ver §5.4) |
| jose | 6 | JWT | Es la librería JWT que funciona en el runtime Edge (Web Crypto, no `node:crypto`) |
| bcryptjs | 3 | Hash de contraseñas | Implementación JS pura: no necesita binarios nativos, funciona en cualquier runtime |
| Zod | 4 | Validación | Toda entrada externa (FormData, args de actions) se valida antes de tocar la DB |
| Tailwind CSS | 4 | Estilos | Tokens de diseño vía `@theme` en CSS, sin `tailwind.config.js` |
| Vitest | 4 | Tests | Solo testea los módulos puros (motor del torneo, reglas, formato) |
| lucide-react | 1 | Iconos | SVG tree-shakeable, reemplazó emojis (commit `32ef071`) |

> **Ojo con Next 16**: `AGENTS.md` advierte que esta versión tiene breaking changes respecto
> a lo que conoces. Los más visibles en este repo: el middleware ahora se llama **proxy**
> (`src/proxy.ts` exporta `proxy()` en vez de `middleware()`), y `params`, `searchParams` y
> `cookies()` son **Promises** que hay que `await`. La documentación de referencia vive en
> `node_modules/next/dist/docs/`.

---

## 2. La idea arquitectónica central: "la DB guarda hechos, el código deriva todo lo demás"

Es la decisión más importante del proyecto y de la que se desprende casi todo:

```
┌─────────────────────────────────────────────────────────────┐
│  seed-data.ts (constante en código)                         │
│  48 equipos + 104 partidos + reglas de cruces FIFA          │
└──────────────┬──────────────────────────────────────────────┘
               │ importado por server Y client
┌──────────────▼──────────────────────────────────────────────┐
│  Motor puro (src/lib/tournament/)                           │
│  standings → thirds → bracket → scoring                     │
│  Funciones puras: (ScoreMap) → resultado derivado           │
└──────────────┬──────────────────────────────────────────────┘
               │ alimentado por
┌──────────────▼──────────────────────────────────────────────┐
│  Postgres (Neon): SOLO hechos introducidos por humanos      │
│  predictions (usuario) · results (admin) · overrides (admin)│
└─────────────────────────────────────────────────────────────┘
```

**Qué NO se guarda en la base de datos**: posiciones de grupo, ranking de terceros,
cruces del bracket, puntos de cada usuario, la tabla general. Todo eso se **recalcula
en cada request** a partir de los marcadores guardados.

Por qué esto es buena idea aquí:

1. **Imposible des-sincronizarse.** No existe el bug clásico de "la tabla cacheada no
   refleja el último resultado". No hay jobs, ni triggers, ni columnas derivadas que
   invalidar.
2. **Una sola implementación para dos universos.** `buildBracket(scores)` recibe un
   `ScoreMap` genérico: si le pasas las predicciones de un usuario obtienes *su* bracket;
   si le pasas los resultados oficiales obtienes el bracket *real*. La misma función,
   probada una vez, sirve para ambos (mira `scoreUser` en `scoring.ts:69-70`).
3. **Testeable sin DB.** El motor completo se prueba con Vitest en Node puro, sin mocks
   de base de datos (`vitest.config.ts` ni siquiera configura DB).
4. **Es viable porque el dominio es pequeño**: 104 partidos × N usuarios cabe en memoria
   y el cálculo es O(pequeño). En un dominio grande esto se materializaría — la lección es
   saber *cuándo* puedes permitirte derivar en vez de persistir.

El patrón general se llama **derived state / event sourcing ligero**: persistes los
hechos mínimos e inmutables del dominio y derivas las vistas. Compáralo con guardar
`points` en una columna de `users`: cada corrección de un resultado oficial obligaría a
recalcular y reescribir filas.

### 2.1 El seed estático como "tabla en código"

`seed-data.ts` define los 48 equipos y 104 partidos como constantes TypeScript. Existe
*también* en la DB (tablas `teams` y `matches`, pobladas por `seed.ts`), lo que parece
redundante pero tiene sentido:

- **El cliente lo necesita** para render instantáneo (tabs de fases, grupos, calendario)
  sin fetch. Importar una constante es gratis; pedirla a la DB en cada render no.
- **El servidor necesita la copia en DB** para integridad referencial (FKs de
  `predictions.matchId`, `results.matchId`) y para el único campo mutable: `open_override`.
- La convención que los une: `team.id` en DB = índice 1-based en el array `TEAMS`
  (`dto.ts:30`), y `match.id` = número oficial FIFA 1-104. **Claves naturales**, no
  autoincrementales — esto hace que seed sea idempotente y que un id de partido signifique
  lo mismo en código, DB, URL (`/partido/57`) y conversación entre humanos.

La notación de cruces es un mini-DSL en los campos `homeSource`/`awaySource`:

| Notación | Significado |
|---|---|
| `"A1"` / `"A2"` | ganador / segundo del grupo A |
| `"3ABCDF"` | un tercero de los grupos A, B, C, D o F (restricción de slot FIFA) |
| `"W73"` / `"L101"` | ganador del partido 73 / perdedor del 101 |

`bracket.ts:132-152` lo interpreta con tres ramas: regex `^[A-L][12]$`, prefijo `3`, y
referencia `W`/`L`. Como los partidos se procesan en orden de id, las referencias
`W73` siempre apuntan a un slot ya resuelto (programación dinámica implícita).

---

## 3. Estructura del proyecto

```
src/
├── proxy.ts                      ← "middleware" de Next 16: gate de auth por cookie
├── app/
│   ├── layout.tsx                ← root: fuentes, metadata, <html lang="es">
│   ├── globals.css               ← design tokens Tailwind v4 (@theme)
│   ├── (auth)/                   ← route group: layout centrado, sin nav
│   │   ├── login/ · registro/
│   └── (app)/                    ← route group: layout con header + nav, requireUser()
│       ├── quiniela/             ← captura de pronósticos (la pantalla principal)
│       ├── bracket/              ← bracket propio vs real, lado a lado
│       ├── tabla/                ← ranking del grupo + [userId] hoja ajena
│       ├── partido/[matchId]/    ← comparativa de picks de un partido
│       └── admin/                ← resultados oficiales + gestión de grupos
├── components/                   ← UI compartida (MatchCard, GroupTabs, form-fields…)
└── lib/
    ├── db/        schema.ts · index.ts · seed-data.ts · seed.ts
    ├── auth/      jwt.ts (edge-safe) · session.ts (server-only)
    ├── actions/   auth.ts · predictions.ts · admin.ts · groups.ts  ("use server")
    ├── tournament/ standings · bracket · scoring · types  (PURO, sin I/O)
    ├── rules.ts   reglas de negocio compartidas server/cliente
    ├── dto.ts     shapes serializables server→cliente
    ├── score-rows.ts  conversores fila-DB ↔ shape-del-motor
    ├── groups.ts  helpers de códigos de invitación
    └── format.ts  formateo de fechas (Intl)
```

Observa la **separación por naturaleza, no por feature**:

- `tournament/` y `rules.ts` son **puros**: cero imports de DB, Next o React. Son los
  únicos con tests unitarios — frontera de testeo deliberada.
- `actions/` es la **capa de escritura**: todo lo que muta datos pasa por aquí.
- Las páginas son la **capa de lectura**: Server Components que consultan la DB
  directamente con Drizzle (sin capa de API intermedia — patrón válido cuando el
  servidor de render ES tu backend).
- `dto.ts` y `score-rows.ts` son **adaptadores** entre las tres representaciones de un
  marcador: fila de DB (`homeScore`), shape del motor (`Map<number, Score>`) y shape
  serializable para props de Client Components (`Record<number, ScoreDTO>` — los `Map`
  no sobreviven la serialización RSC→cliente, por eso existen ambos).

### 3.1 Route groups

`(auth)` y `(app)` no afectan la URL (`/login`, no `/auth/login`); existen solo para dar
**layouts distintos a árboles distintos**: el de `(auth)` centra una tarjeta; el de
`(app)` además ejecuta `requireUser()` — un segundo candado de sesión (el primero es el
proxy) y renderiza header + nav responsive (links en header en desktop, bottom-bar en
móvil, mismo componente `NavLinks` montado dos veces con CSS `hidden md:block`).

---

## 4. Autenticación: JWT stateless, hecho a mano y por qué

No hay NextAuth/Auth.js ni Clerk. Para un proyecto de este tamaño (login con email+password,
un solo admin), una sesión JWT manual son ~90 líneas y cero dependencias de servicio:

### 4.1 La separación edge/node (`jwt.ts` vs `session.ts`)

Este split es la decisión sutil del módulo:

- **`auth/jwt.ts`** — solo firma/verifica con `jose`. El comentario lo dice explícito:
  *"Edge-safe: imported by middleware. No next/headers here."* El proxy de Next corre en
  el runtime Edge, donde no hay APIs de Node; `jose` usa Web Crypto, así que funciona en
  ambos mundos.
- **`auth/session.ts`** — usa `cookies()` de `next/headers` y `redirect()`: solo puede
  importarse desde RSC y Server Actions. Expone los guards `getSession`, `requireUser`,
  `requireAdmin`.

Lección general: cuando un proyecto tiene código que corre en dos runtimes, **divide los
módulos por runtime y deja que el grafo de imports lo haga cumplir** (si `proxy.ts`
importara `session.ts`, el build fallaría).

### 4.2 El token

```ts
// payload: { sub: userId, name: displayName, admin: boolean }
HS256, expira en 30 días, secreto en JWT_SECRET
```

- Cookie `session`: `httpOnly` (JS no puede leerla → mitiga XSS), `sameSite: "lax"`
  (mitiga CSRF en mutaciones — los POST cross-site no llevan la cookie), `secure` solo en
  producción, `maxAge` 30 días.
- **Stateless**: no hay tabla de sesiones. Costo: no se puede revocar un token antes de
  que expire (trade-off aceptado: dominio de bajo riesgo). Beneficio: cero queries para
  saber quién eres.
- `admin` viaja **dentro del token** firmado, decidido en el registro comparando contra
  `ADMIN_EMAIL` (env var). Simple, pero implica que cambiar el rol requiere re-login.

### 4.3 Defensa en profundidad (3 capas)

1. **Proxy** (`src/proxy.ts`): redirige a `/login` sin token válido, bloquea `/admin/*`
   para no-admins, y redirige usuarios logueados fuera de `/login`. Es UX, no la
   autoridad.
2. **Layouts/páginas**: `requireUser()` / `requireAdmin()` en cada RSC.
3. **Server Actions**: cada action re-verifica el JWT por su cuenta. El comentario en
   `session.ts` resume el principio: *"user ids are ONLY ever taken from the verified
   token, never from input"*. Ninguna action acepta un `userId` como parámetro — siempre
   sale de `session.sub`. Esto elimina de raíz toda una clase de bugs IDOR
   ("guardar una predicción a nombre de otro").

¿Por qué no confiar solo en el proxy? Porque las Server Actions son **endpoints HTTP
públicos** — cualquiera puede invocarlas con `curl` saltándose la UI. La regla mental:
*el middleware filtra, pero cada punto de entrada de datos valida y autoriza por sí
mismo*.

### 4.4 Detalles de registro/login que vale la pena copiar

(`actions/auth.ts`)

- Email normalizado a lowercase antes de buscar/insertar.
- El error de email duplicado se detecta por el **nombre del constraint**
  (`users_email_unique`) en el mensaje del error de Postgres — la unicidad la garantiza
  la DB, no un `SELECT` previo (que tendría race condition).
- En login, la comparación bcrypt corre aunque el flujo vaya a fallar, y el error es el
  mismo para "email no existe" y "password mal" → no se filtra qué emails están
  registrados (anti user-enumeration).
- bcrypt cost 10: balance estándar coste/latencia para serverless.

---

## 5. Capa de datos

### 5.1 Schema (Drizzle, `db/schema.ts`)

7 tablas. Decisiones notables:

- **PKs compuestas donde la relación ES la entidad**: `predictions (userId, matchId)` y
  `group_members (groupId, userId)`. No hay columna `id` artificial: la clave natural
  expresa "un usuario tiene a lo sumo una predicción por partido" a nivel de DB, y
  habilita el upsert de §5.3.
- **Enums de Postgres** (`pgEnum`) para `phase` y `winner_side`: el dominio cerrado vive
  en la DB, no solo en TS.
- **`smallint` para ids de partidos/equipos y marcadores**: tipos del tamaño del dominio.
- **`onDelete: "cascade"`** en `predictions.userId` y en `group_members`: borrar un
  usuario limpia sus datos dependientes sin lógica de aplicación.
- **`results.enteredBy`**: auditoría mínima — quién capturó cada resultado oficial.
- **Dos tablas de "override" del admin** que son la válvula de escape del modelo derivado:
  - `matches.open_override` (boolean): reabre un partido ya iniciado para que alguien que
    se unió tarde pueda capturar (el caso "late onboarding" comentado en el schema).
  - `knockout_overrides`: corrige manualmente los cruces *reales* si la derivación
    difiere de lo que FIFA publique (ver §6.3). Patrón a recordar: **cuando derivas
    estado de reglas externas que podrían cambiar, deja un mecanismo de corrección manual
    con prioridad sobre el cálculo.**

### 5.2 Conexión lazy singleton (`db/index.ts`)

```ts
let _db = null;
export function getDb() { if (!_db) { ...; _db = drizzle(neon(url), { schema }); } return _db; }
```

El comentario explica el porqué: *"Lazy so the app builds and unit tests run without
DATABASE_URL set."* Si el módulo creara la conexión en el top-level, **importar**
cualquier cosa que transitivamente importe la DB (p. ej. los tests del motor) explotaría
sin la env var. Regla general: en módulos compartidos, los efectos colaterales van dentro
de funciones, no en el cuerpo del módulo.

### 5.3 Upsert como primitiva de escritura

Casi todas las escrituras usan `.onConflictDoUpdate()` / `.onConflictDoNothing()`
(`INSERT ... ON CONFLICT` de Postgres):

- Guardar predicción: upsert sobre la PK compuesta → "crear o editar" es una sola query
  atómica, sin `SELECT` previo ni race conditions.
- `joinGroupByCode`: `onConflictDoNothing().returning()` — si `returning` viene vacío,
  ya era miembro. La DB responde la pregunta "¿existía?" sin query extra.
- El seed (`seed.ts`) es **idempotente** por la misma vía: correrlo N veces actualiza
  datos FIFA sin tocar `open_override` ni datos de usuarios.

### 5.4 La restricción que moldea el código: neon-http no tiene transacciones

El driver HTTP de Neon ejecuta cada query como request independiente → no hay
`BEGIN/COMMIT`. El código lo compensa con **ordenamiento defensivo**, visible en el
registro (`actions/auth.ts:56-58`):

```
// Resolve the invite code BEFORE creating the user (neon-http has no
// transactions): a bad code must never leave a half-registered account.
```

1. Primero la validación que puede fallar (¿existe el código de invitación?).
2. Luego la escritura principal (crear usuario).
3. Al final la escritura secundaria (unirse al grupo) envuelta en try/catch **no fatal**:
   si falla, la cuenta ya existe y el usuario puede reintentar unirse desde `/tabla`.

Es el patrón **saga en miniatura**: ordena las operaciones para que un fallo a medias
deje el sistema en un estado recuperable, y decide explícitamente qué fallos son fatales
y cuáles no.

---

## 6. El motor del torneo (`src/lib/tournament/`) — el corazón algorítmico

Todo el módulo opera sobre una abstracción única:

```ts
type ScoreMap = ReadonlyMap<number, Score>;  // matchId → {home, away, winnerSide?}
```

predicciones de un usuario y resultados reales son **el mismo tipo** → todas las
funciones sirven para ambos universos.

### 6.1 `standings.ts` — posiciones de grupo con desempate FIFA

`computeGroupStandings` implementa el reglamento real:

1. Orden global: puntos → diferencia de goles → goles a favor.
2. **Clusters de empate total**: recorre el array ordenado detectando rachas empatadas en
   los tres criterios, y re-ordena cada cluster recalculando los mismos tres criterios
   **solo con los partidos entre los empatados** (head-to-head).
3. Último desempate: `drawPosition` (posición del sorteo) — determinista, *"No drawing
   of lots"*: una quiniela no puede depender de una moneda al aire.

Detalle de diseño: acepta grupos **incompletos** (filtra `scores.has(m.id)`), así la
tabla "según tu quiniela" funciona en vivo mientras vas capturando.

`rankThirds` ordena los 12 terceros (puntos → DG → GF → letra de grupo) y marca los 8
mejores como clasificados. Devuelve `null` si falta algún grupo — **usar `null` como
"todavía no se puede calcular"** recorre todo el motor y permite que la UI distinga
"vacío" de "pendiente".

### 6.2 `bracket.ts` — el problema interesante: asignar terceros a slots

El formato 2026 mete a 8 de los 12 terceros en dieciseisavos, pero cada slot solo admite
terceros de ciertos grupos (`"3ABCDF"`). Dado *qué* 8 grupos clasificaron, ¿qué tercero
va a qué slot? Es un problema de **matching bipartito** (slots × grupos).

- `thirdsAssignmentFeasible` implementa el **algoritmo de Kuhn** (caminos aumentantes,
  el clásico de matching máximo en grafos bipartitos): responde "¿existe asignación
  completa?".
- `assignThirdSlots` lo usa de forma golosa-con-verificación: recorre los slots en orden
  de número de partido y a cada uno le da el candidato **alfabéticamente menor que no
  haga infactible el resto** (se comprueba re-ejecutando Kuhn sobre lo que queda). Esto
  produce una asignación única y determinista.

¿Por qué inventarse esto? El comentario del código lo confiesa: la tabla oficial de FIFA
(Anexo C, 495 combinaciones) **no es reproducible desde fuentes públicas**. Decisión de
ingeniería ejemplar ante un spec externo incompleto:

1. Documentar la aproximación (es determinista y respeta las restricciones publicadas).
2. Aplicarla **idénticamente** a predicciones y realidad (justo entre jugadores aunque
   difiera de FIFA).
3. Dejar `knockout_overrides` para corregir el bracket real si FIFA publica otra cosa —
   los overrides se aplican por lado (`home`/`away`) por encima de la derivación
   (`bracket.ts:154-162`).

### 6.3 `scoring.ts` — puntuación

| Acierto | Puntos |
|---|---|
| Marcador exacto (grupos) | 3 |
| Solo el resultado 1X2 (grupos) | 1 |
| Equipo presente en 32avos / 16avos / 4tos / semis / final | 1 / 2 / 3 / 4 / 6 por equipo |
| Campeón | 8 |

La sutileza del avance: se compara **presencia en la ronda, no el slot exacto**
(`teamsInRound` → intersección de Sets). Si pusiste a Brasil en semis por el lado
equivocado del cuadro, igual puntúa. El partido por el tercer puesto no puntúa nunca.
`UserScore` devuelve también los desgloses (`groupPointsByMatch`, `advanceByRound`) que
la UI usa para explicar el puntaje en la hoja de cada usuario.

---

## 7. Server side: cómo fluyen lectura y escritura

### 7.1 Lecturas: RSC consultan la DB directo

Patrón uniforme en todas las páginas de `(app)`:

```ts
export const dynamic = "force-dynamic";          // 1

export default async function Page({ searchParams }) {
  const session = await requireUser();           // 2
  const [a, b, c] = await Promise.all([...]);    // 3  queries paralelas
  const derived = motor(a, b, c);                // 4  cálculo puro
  return <UI ... /> or <Client initial={...} />; // 5
}
```

1. **`force-dynamic`**: opta fuera del caching de Next. Correcto aquí porque cada render
   depende de la cookie de sesión y de datos que cambian (resultados). En esta versión de
   Next el modelo de caché es explícito — mejor declarar la intención.
2. Auth en la página misma (capa 2 de §4.3).
3. `Promise.all` para no serializar round-trips — con un driver HTTP cada query es un
   fetch, así que esto importa más que con un pool TCP.
4. La página es delgada: el trabajo real lo hace el motor puro.
5. Dos variantes: render directo en servidor (tabla, partido) o hidratar un Client
   Component con estado inicial (quiniela, bracket, admin).

Ejemplo de `Promise.all` con queries *condicionales* en `partido/[matchId]/page.tsx:40-67`:
una rama es `Promise.resolve([])` si no hay grupo seleccionado — mantiene la forma del
destructuring sin condicionales anidados.

### 7.2 Escrituras: Server Actions, dos sabores

**Sabor A — formularios (`useActionState`)**: login, registro, crear grupo, unirse.

```ts
// firma: (prevState, formData) => Promise<State>
const [state, formAction, pending] = useActionState(login, { error: null });
<form action={formAction}>
```

Progressive enhancement de React 19: el form funciona como POST clásico, `pending` da el
estado de envío sin `useState` manual, y los errores regresan como **valores** (`{ error }`)
renderizados junto al campo.

**Sabor B — llamadas imperativas**: `savePrediction`, `saveOfficialResult`, etc. Reciben
`input: unknown`, lo parsean con Zod y devuelven un resultado discriminado:

```ts
type SaveResult = { ok: true } | { ok: false; error: string };
```

Dos cosas a copiar de aquí:

- **`unknown` en la firma**: aunque TS "garantice" el tipo del caller, por la red puede
  llegar cualquier cosa (las actions son endpoints públicos). Zod es el cast de verdad.
- **Errores esperados como valores, no excepciones**: el cliente hace
  `if (!response.ok)` y pinta el error. Las excepciones quedan para lo inesperado.

Cada action termina con `revalidatePath(...)` sobre las rutas afectadas — purga el cache
del router para que la siguiente navegación vea datos frescos.

### 7.3 La autoridad es el servidor (re-validación de reglas)

`savePrediction` no confía en que la UI haya deshabilitado el input de un partido cerrado:
relee el partido de la DB y re-ejecuta `isMatchOpen()` (¿kickoff en el futuro u
`open_override`?) y `normalizeWinnerSide()` (un empate en eliminatorias exige ganador por
penales; un partido de grupos no debe llevarlo). El comentario en `rules.ts` lo formula
como principio: *"The server is the authority: actions re-check these regardless of what
the client rendered."* La UI muestra candados (advisory); el servidor los aplica
(authoritative).

---

## 8. Client side: los patrones de React que vale la pena estudiar

`quiniela-client.tsx` es el componente más rico. Patrones:

### 8.1 Autosave optimista con debounce por entidad

```
setScore() → setState inmediato (optimista) → scheduleSave()
scheduleSave: clearTimeout(timers[matchId]); timers[matchId] = setTimeout(save, 650ms)
```

- **Un timer por partido** (`useRef<Record<number, timeout>>`): editar el partido 12 no
  pospone el guardado del 30. Debounce *por clave*, no global.
- Estado de guardado por partido (`saving → saved → null` con auto-limpieza a 1.6s, o
  `error`, o `pendingWinner` si un empate de eliminatorias aún no tiene ganador de
  penales — el guardado se **retiene** hasta que el dato esté completo).
- No hay botón "Guardar": la predicción viaja sola tras 650ms de inactividad. UX de
  autosave con costo de implementación mínimo gracias a que la action es idempotente
  (upsert).

### 8.2 Estado derivado con `useMemo`, igual que en el servidor

```ts
const scoreMap = useMemo(() => toScoreMap(predictions), [predictions]);
const bracket  = useMemo(() => buildBracket(scoreMap), [scoreMap]);
```

El cliente ejecuta **el mismo motor** que el servidor (es código puro e isomorfo): al
cambiar un marcador de grupos, el bracket del usuario se rearma en vivo sin round-trip.
Esta es la recompensa concreta de la pureza de `tournament/`.

### 8.3 Hidratación y zonas horarias

Dos técnicas distintas para el mismo enemigo (server render ≠ client render):

- **`useSyncExternalStore(() => () => {}, () => true, () => false)`** — el idiom moderno
  de "¿ya monté?": devuelve `false` en servidor/hidratación y `true` después, sin el
  `useEffect(() => setMounted(true))` que fuerza un re-render extra. La sección "Hoy"
  depende del *día local del espectador*, que el servidor no conoce → se omite en SSR.
- **`suppressHydrationWarning`** en los `<time>` de kickoff: el texto formateado con
  `Intl` difiere entre la TZ del servidor y la del browser; aquí la divergencia es
  esperada y benigna, así que se silencia puntualmente (nunca globalmente).

También: `const [now] = useState(() => Date.now())` congela "ahora" una vez por mount —
los candados de la UI no parpadean durante la sesión; la verdad temporal la tiene el
servidor de todos modos.

### 8.4 Anti-copy: la regla transversal de visibilidad

*"Los picks ajenos se revelan solo cuando el partido ya no es editable"*
(`isPredictionVisibleToOthers = !isMatchOpen`). Implementada en el servidor en cada
lectura de datos ajenos:

- `/partido/[matchId]`: si el partido sigue abierto, ni siquiera se mandan las filas.
- `/tabla/[userId]`: filtra `MATCHES` a los bloqueados antes de render. Y un detalle
  fino comentado en el código: los cruces del bracket ajeno no filtran nada extra porque
  *para cuando un partido de eliminatorias se bloquea, todas las predicciones de grupos
  que lo alimentan ya están bloqueadas también* — un invariante temporal del dominio
  usado como argumento de seguridad.
- Autorización de la hoja ajena: solo co-miembros de algún grupo (o admin), y la
  negación es **`notFound()` en vez de redirect** para no revelar que el usuario existe.

### 8.5 Estado de UI en la URL vs `useState`

- La pestaña de *grupo de amigos* va en la URL (`/tabla?grupo=<id>`): es compartible y
  navega server-side (los datos cambian por grupo). Con fallback silencioso si el id no
  es visible para ti: `visibleGroups.find(...) ?? visibleGroups[0]` — nunca un error, y
  como la búsqueda es dentro de *tu* lista, un id ajeno no filtra nada.
- La pestaña de *fase/grupo del torneo* en `/quiniela` es `useState` local: es puro
  estado de vista sobre datos ya cargados; no amerita round-trip.

---

## 9. Sistema de diseño

- **Tailwind v4 sin config JS**: los tokens viven en `globals.css` dentro de `@theme`
  (`--color-pitch-*` fondos verdes noche, `--color-volt-*` verde lima de acento,
  `--color-gold-*`, `--color-ink-*` para texto). Cada token genera utilidades
  (`bg-pitch-900`, `text-volt-400`) — la paleta semántica vive en CSS puro.
- **3 fuentes vía `next/font`** (self-hosted automático, sin FOUT): Bricolage Grotesque
  (display), Chivo (texto), Chivo Mono (números/marcadores — `font-mono` en todos los
  scores para alineación tabular). Se inyectan como CSS variables y se mapean a
  `--font-display/sans/mono` en el theme.
- Detalles de oficio: grain de ruido SVG inline en `body::before`, radial-gradients
  fijos como iluminación de estadio, `min-h-dvh` (no `vh` — mobile correcto),
  `backdrop-blur` en headers sticky, `<details>/<summary>` nativo para la sección
  colapsable "Hoy" (cero JS de estado).
- Accesibilidad puntual: `aria-hidden` en iconos decorativos, `aria-label` en los de
  significado (medallas), idioma declarado (`<html lang="es">`).

---

## 10. Testing

Vitest con `environment: "node"`, sin DOM ni mocks de DB. Solo se testea la **lógica
pura**: `rules`, `groups` (formato de códigos), `format`, `seed-data` (sanidad de los
104 partidos), y el motor (`standings`, `bracket`, `scoring`).

La estrategia implícita: **empuja la complejidad hacia funciones puras y testea esa
frontera**. Las páginas y actions son "pegamento" delgado (query → motor → render) cuyo
riesgo es bajo; el motor (desempates, matching de terceros, scoring) es donde viven los
bugs caros, y se cubre barato sin infraestructura.

`npm test` · `npm run db:push` (sincroniza schema, sin migraciones versionadas — válido
para un proyecto de vida corta con un solo entorno) · `npm run db:seed` (idempotente).

---

## 11. Seguridad — resumen de capas

| Amenaza | Mitigación |
|---|---|
| Acceso sin sesión | proxy + `requireUser()` en layout/página + verificación en cada action |
| Escalación a admin | flag `admin` dentro del JWT firmado; `requireAdmin()` en cada action de admin |
| IDOR (escribir como otro) | el `userId` jamás viene del input; siempre de `session.sub` del token verificado |
| XSS roba sesión | cookie `httpOnly` |
| CSRF | `sameSite: "lax"` + actions que solo mutan vía POST |
| Inyección | Drizzle parametriza todo; Zod valida shape y rangos antes |
| Copiar picks ajenos | regla de visibilidad server-side (§8.4) |
| Enumerar usuarios | error idéntico en login; `notFound()` en hojas ajenas no autorizadas |
| Predicción tras el kickoff | `isMatchOpen` re-validado en el servidor con el reloj del servidor |

---

## 12. Sync automático de resultados (Vercel Cron + football-data.org)

### 12.1 Por qué un cron y no un webhook

La alternativa (webhook desde el proveedor de datos) requeriría que football-data.org soporte
push — no lo hace. El cron es pull: Vercel llama al endpoint en los horarios configurados.

### 12.2 Cómo funciona el mecanismo

```
vercel.json
  6 entradas en "crons" → cada una corre UNA VEZ POR DÍA a hora distinta
       │ GET /api/cron/sync-results
       │ Authorization: Bearer <CRON_SECRET>
       ▼
  route handler (App Router, force-dynamic)
       │ 1. Valida el header
       │ 2. Llama football-data.org /v4/competitions/WC/matches (ayer + hoy)
       │ 3. Matchea por kickoffAt (minuto exacto)
       │ 4. Salva si no existe resultado → INSERT ... ON CONFLICT DO NOTHING
       ▼
  tabla `results` (Neon)
       │ revalidatePath() en /quiniela, /bracket, /tabla, /admin/resultados
```

**Regla principal**: si el partido ya tiene resultado en la DB (entrado por admin), el cron
lo **ignora completamente**. La edición humana siempre tiene prioridad. El
`ON CONFLICT DO NOTHING` es el net de seguridad contra race conditions.

### 12.3 Ventana de partidos (horarios UTC del Mundial 2026)

Los 6 crons cubren todos los kickoffs posibles:

| Cron UTC | Cubre kickoffs que terminaron hacia esa hora |
|---|---|
| 19:00 | 16:00–17:00 |
| 21:00 | 18:00–19:00 |
| 23:00 | 20:00–21:00 |
| 01:00 | 22:00–23:30 (incluye partidos que cruzan medianoche) |
| 03:00 | 00:00–01:30 |
| 06:00 | 03:00–04:00 (kickoffs más tardíos) |

El handler siempre consulta ayer + hoy UTC, resolviendo el edge case de partidos que
empiezan a las 23:xx y terminan después de las 00:00 del día siguiente.

### 12.4 Mapeo de marcadores con tiempo extra y penales

football-data.org distingue `fullTime`, `extraTime` y `penalties`:

```
score.extraTime.home != null  →  homeScore = extraTime.home  (incluye los 120 min)
                  null        →  homeScore = fullTime.home   (solo 90 min)

score.penalties.home != null + nuestro phase != "group"  →  winnerSide = "home" | "away"
```

Esto preserva la semántica del schema: `homeScore`/`awayScore` son el marcador final en
juego (sin contar penales), y `winnerSide` solo existe cuando los penales decidieron el
ganador.

### 12.5 Schema change

`results.enteredBy` pasó de `NOT NULL` a nullable. Cuando el cron inserta, guarda `null`.
La UI no mostraba ni usaba ese campo, así que no hay impacto visible.

### 12.6 Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `FOOTBALL_DATA_API_KEY` | API key de football-data.org (cuenta gratuita, tier WC incluido) |
| `CRON_SECRET` | Secreto aleatorio; Vercel lo envía como `Authorization: Bearer <secret>` |

**Rate limits del tier gratuito**: 10 req/min. Con 6 cron runs/día, cada uno haciendo
1 llamada, estamos a ~0.004% del límite.

### 12.7 Límites de Vercel Cron por plan

| Plan | Crons | Intervalo mínimo | Precisión |
|---|---|---|---|
| Hobby | 100 | 1 vez/día | ±59 min |
| Pro | 100 | 1 vez/min | exacto |

En Hobby, cada entrada del array `crons` es un job independiente que corre una vez
al día a su hora asignada. Con 6 entradas apuntando al mismo path, se logran 6 ejecuciones
diarias sin violar el límite.

---

## 13. Ideas para llevarte (transferibles a cualquier proyecto)

1. **Persiste hechos, deriva vistas** — y reconoce cuándo el dominio es lo bastante
   pequeño para permitírtelo (§2).
2. **Una abstracción de datos compartida (`ScoreMap`) multiplica el motor**: el mismo
   código sirve para el universo predicho y el real (§6).
3. **Divide módulos por runtime** y deja que los imports lo hagan cumplir (§4.1).
4. **El servidor es la autoridad**: la UI muestra reglas, las actions las aplican; toda
   action valida con Zod desde `unknown` y saca la identidad solo del token (§7).
5. **Sin transacciones, ordena para fallar seguro**: validar → escritura principal →
   secundarias no-fatales (§5.4).
6. **Upsert + claves naturales** vuelven las escrituras idempotentes y los reintentos
   triviales (§5.3).
7. **Deja válvulas de escape manuales** (`open_override`, `knockout_overrides`) cuando tu
   lógica modela reglas externas que pueden divergir (§5.1, §6.2).
8. **Errores esperados como valores**, excepciones solo para lo inesperado (§7.2).
9. **Frontera de tests = frontera de pureza**: motor puro con tests, pegamento sin (§10).
10. **Hidratación y tiempo**: todo lo que dependa de la TZ del viewer se decide en el
    cliente (`useSyncExternalStore` para mounted, `suppressHydrationWarning` quirúrgico) (§8.3).

## 14. Para profundizar

- Docs de la versión exacta de Next: `node_modules/next/dist/docs/01-app/` — en especial
  `16-proxy.md`, `06-fetching-data.md`, `07-mutating-data.md`, `08-caching.md` y la guía
  `02-guides/data-security.md`.
- Specs de producto del propio repo: `docs/quiniela-app.md`, `docs/list-of-rules.md`,
  `docs/groups-feature.md`, `docs/per-match-predictions.md`.
- Algoritmo de Kuhn / matching bipartito: busca "Kuhn's algorithm maximum bipartite
  matching" (cp-algorithms tiene la mejor explicación).
