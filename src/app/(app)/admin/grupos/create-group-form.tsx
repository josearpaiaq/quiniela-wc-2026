"use client";

import { useActionState, useState } from "react";
import { createGroup, type GroupFormState } from "@/lib/actions/groups";

const initialState: GroupFormState = { error: null };

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, initialState);

  return (
    <form
      action={formAction}
      className="space-y-2 rounded-xl border border-line bg-pitch-900 p-4"
    >
      <div className="flex gap-2">
        <input
          name="name"
          placeholder="Nombre del grupo (ej. La oficina)"
          required
          maxLength={60}
          className="w-full rounded-lg border border-line bg-pitch-800 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500/60 outline-none transition focus:border-volt-400 focus:ring-2 focus:ring-volt-400/25"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 cursor-pointer rounded-lg bg-volt-400 px-4 font-display text-xs font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-volt-300 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear grupo"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger-400">
          {state.error}
        </p>
      )}
      {state.success && <p className="text-sm text-volt-400">{state.success}</p>}
    </form>
  );
}

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:border-line-bright hover:text-ink-100"
    >
      {copied ? "¡Copiado!" : "Copiar"}
    </button>
  );
}
