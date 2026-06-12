# Feature: Grupos de participantes con código de invitación

## Contexto

Hoy la quiniela tiene un solo pool global: `/tabla` rankea a **todos** los usuarios. Se quiere que el admin cree grupos con un código compartible; un participante puede pertenecer a varios grupos (o a ninguno). Quien se registra con código entra a ese grupo; sin código se registra igual, puede pronosticar, pero no ve tabla de posiciones hasta unirse a un grupo. La tabla queda scopeada al grupo seleccionado.

Decisiones confirmadas con José:
- Admin v1 mínimo: crear grupo, ver código y miembros (sin eliminar/expulsar/regenerar).
- Multi-grupo: selector en `/tabla` (default = primer grupo al que se unió).
- Unirse después: desde `/tabla` (form si no tiene grupo; afford discreto "Unirse a otro grupo" si ya tiene).

Datos verificados del repo:
- Drizzle ORM + Neon (`drizzle-orm/neon-http`, **sin transacciones** — ordenar operaciones para fallar seguro). Migraciones vía `npm run db:push` (no hay carpeta de migraciones).
- Next 16: `searchParams`/`params` son Promises.
- `src/proxy.ts` ya protege `/admin/*` — sin cambios ahí.

## 1. Schema — `src/lib/db/schema.ts`

Agregar al final, estilo existente:

```ts
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);
```

PK compuesta = join duplicado idempotente con `onConflictDoNothing`. `joinedAt` da el orden para el selector. Migrar con `npm run db:push`.

## 2. Helpers puros — nuevo `src/lib/groups.ts`

(Sin `"use server"`; mismo patrón que `src/lib/rules.ts`.)
- `INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"` (sin 0/O/1/I/L).
- `generateInviteCode()`: 6 chars con `node:crypto` randomBytes (~887M combos).
- `normalizeInviteCode(raw)`: `trim().toUpperCase()`.
- `getUserGroups(db, userId)`: `groupMembers ⋈ groups` ordenado por `joinedAt asc`.
- Test unitario vitest para generación/normalización (encaja en `npm run test`).

Colisiones: el `unique()` es la autoridad; en `createGroup` reintentar ~5 veces si el error incluye `groups_invite_code_unique` (misma técnica que `register()` con `users_email_unique` en `src/lib/actions/auth.ts:64`).

## 3. Server actions — nuevo `src/lib/actions/groups.ts`

`"use server"`, patrón de `src/lib/actions/admin.ts`. Estado: `{ error: string | null; success?: string | null }`.

1. **`createGroup`** — `requireAdmin()`; Zod `name: trim().min(1).max(60)`; genera código con retry; `revalidatePath("/admin/grupos")` y `"/tabla"`; retorna success (sin redirect).
2. **`joinGroupByCode`** — `requireUser()`; normaliza código; busca grupo por `inviteCode`; si no existe → `"Código de invitación inválido"`. Insert con `.onConflictDoNothing().returning()`; vacío → `"Ya eres parte de ese grupo"`. Éxito: revalidate + `redirect(\`/tabla?grupo=${group.id}\`)` (redirect al final, fuera de try/catch, como `register()`).

## 4. Registro — `src/lib/actions/auth.ts` + `src/app/(auth)/registro/page.tsx`

- `registerSchema`: agregar `inviteCode: z.string().trim().optional()`; leer `formData.get("inviteCode") || undefined`.
- **Código inválido → falla el registro** con error claro ("Código de invitación inválido — revísalo o déjalo vacío"). Razón: el campo es opcional (dejar vacío = sin grupo); registrar en silencio dejaría al usuario confundido, y al no haber transacciones, validar el código ANTES del insert de usuario evita estados a medias.
- Tras insertar el usuario, insertar membership; si falla (defensivo), log y continuar — el usuario queda sin grupo y puede unirse desde `/tabla`.
- Form: `TextField` "Código de invitación (opcional)", `required={false}`.

## 5. `/tabla` — `src/app/(app)/tabla/page.tsx`

Sigue siendo RSC. `searchParams: Promise<{ grupo?: string | string[] }>`.

1. Grupos visibles: no-admin → `getUserGroups()`; admin → **todos** los grupos (así el admin ve la tabla de cualquier grupo sin página extra).
2. **Sin grupo** (no-admin, 0 memberships): render del header + `JoinGroupForm` ("Aún no estás en ningún grupo. Pide el código a quien organiza la quiniela."), sin queries de standings. Admin sin grupos existentes: empty state con link a `/admin/grupos`.
3. Selección: `selected = visibleGroups.find(g => g.id === grupo) ?? visibleGroups[0]`. Param inválido/ajeno → fallback silencioso (sin fuga: el lookup es contra la lista permitida del viewer).
4. Selector (solo si >1 grupo): pills server-rendered con `<Link href={`/tabla?grupo=${g.id}`}>`, estilo de los filter pills de `admin-client.tsx`.
5. Scoping: reemplazar `db.select().from(schema.users)` por `groupMembers ⋈ users where groupId = selected.id`; predicciones con `inArray(predictions.userId, memberIds)`. Lógica `scoreUser`/sort (líneas 35–45) intacta.
6. Debajo de la tabla: disclosure discreto "Unirse a otro grupo" reutilizando `JoinGroupForm`.

## 6. `JoinGroupForm` — nuevo `src/app/(app)/tabla/join-group-form.tsx`

`"use client"`, `useActionState(joinGroupByCode, …)`, reutiliza `TextField`/`FormError`/`SubmitButton` de `src/app/(auth)/fields.tsx`. Prop `variant: "empty-state" | "discreet"`.

## 7. Restricción `/tabla/[userId]` — `src/app/(app)/tabla/[userId]/page.tsx`

Tras cargar el usuario objetivo: si `!session.admin && session.sub !== userId`, verificar grupo compartido (dos selects de groupIds e intersección en JS — simple y suficiente a esta escala); si no comparten → `notFound()` (no revela existencia, consistente con el patrón actual). Admin ve a todos; uno mismo siempre permitido.

## 8. `/admin/grupos` — nueva página

Patrón de `admin/resultados`:
- `page.tsx` (RSC): `requireAdmin()`, `dynamic = "force-dynamic"`. Query `groups ⟕ groupMembers ⟕ users`, agrupar en JS a `{ id, name, inviteCode, members[] }`. Cards: nombre, miembros, código en badge `font-mono`, link "Ver tabla →" a `/tabla?grupo=…`.
- `create-group-form.tsx` (`"use client"`): input nombre + `useActionState(createGroup, …)`. Opcional: botoncito copiar código (`navigator.clipboard`).

## 9. Navegación

No tocar el tab bar de `src/components/nav.tsx` (móvil, se satura). Agregar sub-nav admin ("Resultados · Grupos") en el header de ambas páginas admin (componente compartido pequeño en `src/app/(app)/admin/`). El item "Admin" sigue apuntando a `/admin/resultados`.

## Orden de implementación

1. Schema + `npm run db:push`
2. `src/lib/groups.ts` + test
3. `src/lib/actions/groups.ts`
4. Registro (action + form)
5. `/admin/grupos` (primero, para generar códigos de prueba)
6. `/tabla` + `join-group-form.tsx`
7. Restricción `/tabla/[userId]`
8. Sub-nav admin

## Verificación E2E

1. `npm run db:push`; confirmar tablas `groups`/`group_members`.
2. `npm run dev`. Como admin → `/admin/grupos` → crear grupo, copiar código.
3. Registrar usuario B **con** código → `/tabla` muestra solo miembros del grupo.
4. Registrar usuario C **sin** código → `/tabla` muestra form de unirse, sin standings; `/quiniela` funciona. Ingresar código → redirige a `/tabla?grupo=…`.
5. Registro con código basura → falla con error, sin fila de usuario en DB.
6. Segundo grupo, B se une vía "Unirse a otro grupo" → aparecen tabs; default = primer grupo; reenviar mismo código → "Ya eres parte de ese grupo".
7. C (sin grupo compartido con D) abre `/tabla/<D-id>` → 404. Admin → visible. B viendo co-miembro → visible.
8. Admin en `/tabla` ve selector con todos los grupos; `?grupo=` inválido cae al default.
9. `npm run lint && npm run test && npm run build`.
