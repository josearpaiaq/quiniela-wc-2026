# Password Change + Admin Reset

## Goal
Implement the approved spec at `docs/superpowers/specs/2026-06-12-cambio-y-reset-password-design.md`: logged-in password change at `/cuenta`, admin-generated temporary passwords at `/admin/usuarios`, forced change after reset.

## Tasks
- [x] Task 1: Read `node_modules/next/dist/docs/` guides relevant to server actions/redirects (per AGENTS.md) → Verify: conventions confirmed before coding
- [x] Task 2: Add `mustChangePassword` boolean (not null, default false) to `users` in `src/lib/db/schema.ts`, run `npm run db:push` → Verify: push succeeds
- [x] Task 3: Create temp password generator in `src/lib/temp-password.ts` (~10 chars, no confusables) + vitest test → Verify: `npm test` passes
- [x] Task 4: Add `mustChangePassword?: boolean` to `SessionPayload` (`src/lib/auth/jwt.ts`), set claim on login (`src/lib/actions/auth.ts`), redirect to `/cuenta` from `(app)/layout.tsx` when claim present → Verify: typecheck passes
- [x] Task 5: Add `changePassword` server action in `src/lib/actions/auth.ts` (verify current pw, min 8 new, update hash, clear flag, reissue cookie) → Verify: typecheck passes
- [x] Task 6: Create `/cuenta` page (user info + change form with two `PasswordField`s, reset banner, success message); make header name in `(app)/layout.tsx` link to `/cuenta` → Verify: page renders in dev
- [x] Task 7: Add `resetUserPassword` admin action in `src/lib/actions/admin.ts` (temp pw, set flag, return plaintext once, skip self) → Verify: typecheck passes
- [x] Task 8: Create `/admin/usuarios` page (user list + reset button with confirm + copy temp pw) and add "Usuarios" tab to `admin-tabs.tsx` → Verify: page renders for admin
- [x] Task 9: Verification — `npm run lint && npm test && npm run build`; manual: change own password, admin reset another user, forced redirect to `/cuenta` on next login → Verify: all pass

## Done When
- [ ] User can change password at `/cuenta` and gets a success message
- [ ] Admin can generate a temp password from `/admin/usuarios`, shown exactly once
- [ ] Login with temp password forces the user to `/cuenta` until changed
