"use client";

import { useState, useTransition } from "react";
import { resetUserPassword } from "@/lib/actions/admin";
import { CopyCodeButton } from "../grupos/create-group-form";

export function ResetPasswordButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (tempPassword) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg border border-volt-400/40 bg-volt-400/10 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-volt-400">
          {tempPassword}
        </span>
        <CopyCodeButton code={tempPassword} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-danger-400">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`¿Resetear la contraseña de ${userName}?`)) return;
          startTransition(async () => {
            const result = await resetUserPassword({ userId });
            if (result.ok) {
              setTempPassword(result.tempPassword);
              setError(null);
            } else {
              setError(result.error);
            }
          });
        }}
        className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-danger-400/60 hover:text-danger-400 disabled:opacity-60"
      >
        {pending ? "Reseteando…" : "Resetear contraseña"}
      </button>
    </div>
  );
}
