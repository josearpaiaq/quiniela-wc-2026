# ⚽ Quiniela Mundial 2026

Quiniela competitiva entre amigos para la Copa del Mundo 2026: cada quien pronostica los 104 partidos, el bracket de eliminación directa se arma con tus propios clasificados de grupos, y la tabla compara puntos contra los resultados reales.

Diseño y reglas completas: [`docs/superpowers/specs/2026-06-11-quiniela-mundial-2026-design.md`](docs/superpowers/specs/2026-06-11-quiniela-mundial-2026-design.md)

## Stack

- **Next.js 16** (App Router, Server Components + Server Actions) + TypeScript
- **Tailwind CSS 4** — tema "partido nocturno"
- **Neon Postgres** + **Drizzle ORM**
- **JWT propio** (`jose`, HS256) en cookie `httpOnly` + bcryptjs
- **Vitest** para el motor del torneo (standings, terceros, bracket, puntaje)

## Setup

```bash
npm install
cp .env.example .env   # y llena los valores
npm run db:push        # crea las tablas en Neon
npm run db:seed        # carga los 48 equipos y 104 partidos oficiales
npm run dev
```

Variables de entorno:

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Connection string de Neon (pooled) |
| `JWT_SECRET` | Secreto para firmar sesiones (`openssl rand -base64 32`) |
| `ADMIN_EMAIL` | El email que queda como admin al registrarse |

## Scripts

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Suite de Vitest (motor + datos del seed + reglas) |
| `npm run db:push` | Sincroniza el schema con la base |
| `npm run db:seed` | Seed idempotente (equipos + partidos; nunca toca datos de usuarios) |

## Reglas de puntaje (resumen)

- **Grupos** (72 partidos): marcador exacto **3 pts** · acertar ganador/empate **1 pt**
- **Tercer puesto** (1 partido): mismo sistema que grupos — exacto **3 pts** · resultado correcto **1 pt**
- **Eliminatorias** (por equipo que avanza a cada ronda real): 32avos **1** · 16avos **2** · cuartos **3** · semis **4** · final **6** · campeón **8**
- **Bonus exacto en eliminatorias**: +**3 pts** adicionales si aciertas el marcador exacto de un partido de fase eliminatoria (r32, r16, cuartos, semis, final)
- Pronósticos editables hasta el kickoff de cada partido (el admin puede desbloquear casos puntuales)
- Los pronósticos ajenos solo se ven cuando el partido ya está bloqueado

## Estructura

```
src/
├── app/(auth)/        login y registro
├── app/(app)/         quiniela · bracket · tabla · admin/resultados
├── lib/tournament/    ⭐ motor puro del torneo (100% unit-tested)
├── lib/db/            schema Drizzle, seed oficial verificado
├── lib/actions/       server actions (auth, pronósticos, admin)
└── proxy.ts           verificación JWT por request
```
