# Cambio y reset de contraseña — Diseño

**Fecha:** 2026-06-12
**Estado:** Aprobado

## Objetivo

Permitir que un usuario cambie su contraseña y que recupere el acceso si la
olvidó, sin depender de emails (los emails de la app no son reales). Sustituye
la idea original de "ver la contraseña actual": los hashes bcrypt son
irreversibles, así que solo existe cambiar o resetear. El toggle de ojo para
ver lo que escribes ya existe (`PasswordField` en
`src/components/form-fields.tsx`) y se reutiliza.

## Alcance

1. **Cambio propio**: usuario logueado cambia su contraseña en `/cuenta`
   ingresando la actual y la nueva.
2. **Reset por admin**: el admin genera una contraseña temporal aleatoria para
   un usuario que la olvidó, se la pasa por fuera de la app (WhatsApp, etc.) y
   la app fuerza el cambio en el siguiente login.

## Datos

- Columna nueva en `users`: `must_change_password boolean not null default false`.

## Acciones de servidor

- `changePassword` (nueva, en `src/lib/actions/auth.ts`): requiere sesión;
  compara la contraseña actual con bcrypt; valida la nueva (mín. 8
  caracteres, mismo criterio que el registro); actualiza el hash y pone
  `must_change_password = false`; reemite la cookie de sesión sin el claim de
  cambio forzado. Errores: contraseña actual incorrecta, nueva inválida.
  Devuelve estado de éxito para mostrar confirmación en el formulario.
- `resetUserPassword` (nueva, en `src/lib/actions/admin.ts`): requiere admin;
  genera una contraseña temporal aleatoria legible (~10 caracteres
  alfanuméricos, sin confundibles tipo `0/O/1/l`); guarda su hash bcrypt;
  marca `must_change_password = true`; devuelve la temporal en claro una única
  vez (no se persiste ni se puede volver a consultar).

El generador de temporales vive en `src/lib/` como función pura testeable.

## Cambio forzado tras reset

- En el login, si el usuario tiene `must_change_password`, el JWT de sesión
  lleva un claim extra: `mustChangePassword?: boolean` en `SessionPayload`.
- El proxy (`src/proxy.ts`) redirige cualquier página a `/cuenta` mientras el
  claim esté presente — ya verifica el JWT por request y conoce el pathname
  (un layout no lo conoce); sin queries extra por página.
- En el formulario, la temporal funciona como "contraseña actual".
- Limitación aceptada: si el admin resetea mientras el usuario tiene una
  sesión abierta, esa sesión vieja sigue válida hasta expirar o re-loguearse
  (app entre conocidos, riesgo asumido).

## UI

- **`/cuenta` ("Mi cuenta")**, dentro de `(app)`: muestra nombre, display name
  y email; formulario de cambio con dos `PasswordField` (actual y nueva, sin
  campo de confirmación — el ojo cumple esa función). Banner explicativo
  cuando se llega por un reset (claim presente). Mensaje de éxito al cambiar.
- **Header**: el nombre del usuario pasa a ser link a `/cuenta`.
- **`/admin/usuarios`**: tab nueva "Usuarios" en `AdminTabs`; lista de
  usuarios (nombre, email) con botón "Resetear contraseña" por fila; pide
  confirmación y al ejecutarse muestra la temporal en claro con botón de
  copiar. El admin no puede resetearse a sí mismo desde ahí (usa `/cuenta`).

## Pruebas

- Test unitario (vitest) del generador de contraseñas temporales: longitud y
  charset sin confundibles.
- Flujos completos (cambio, reset, redirección forzada) se verifican
  manualmente.
