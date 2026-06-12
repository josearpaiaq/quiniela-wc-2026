"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/lib/actions/auth";
import { FormError, PasswordField, SubmitButton } from "@/components/form-fields";

const initialState: ChangePasswordState = { error: null, success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <PasswordField
        label="Contraseña actual"
        name="currentPassword"
        placeholder="••••••••"
        autoComplete="current-password"
      />
      <PasswordField
        label="Contraseña nueva"
        name="newPassword"
        placeholder="Mínimo 8 caracteres"
        autoComplete="new-password"
      />
      <FormError message={state.error} />
      {state.success && (
        <p className="rounded-lg border border-volt-400/40 bg-volt-400/10 px-3 py-2 text-sm text-volt-400">
          Contraseña actualizada
        </p>
      )}
      <SubmitButton pending={pending} pendingText="Guardando…">
        Cambiar contraseña
      </SubmitButton>
    </form>
  );
}
