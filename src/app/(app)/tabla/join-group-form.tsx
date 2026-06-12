"use client";

import { useActionState } from "react";
import { joinGroupByCode, type GroupFormState } from "@/lib/actions/groups";

const initialState: GroupFormState = { error: null };

function CodeForm({ pendingLabel }: { pendingLabel: string }) {
  const [state, formAction, pending] = useActionState(joinGroupByCode, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="inviteCode"
          placeholder="AB3XYZ"
          required
          maxLength={6}
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded-lg border border-line bg-pitch-800 px-3.5 py-2.5 font-mono text-sm uppercase tracking-[0.25em] text-ink-100 placeholder:tracking-[0.25em] placeholder:text-ink-500/60 outline-none transition focus:border-volt-400 focus:ring-2 focus:ring-volt-400/25"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 cursor-pointer rounded-lg bg-volt-400 px-4 font-display text-xs font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-volt-300 active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? pendingLabel : "Unirme"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger-400">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function JoinGroupForm({ variant }: { variant: "empty-state" | "discreet" }) {
  if (variant === "empty-state") {
    return (
      <section className="space-y-4 rounded-2xl border border-line bg-pitch-900 p-6 text-center">
        <p className="text-3xl" aria-hidden>
          🎟️
        </p>
        <div className="space-y-1">
          <h3 className="font-display text-lg font-bold">Aún no estás en ningún grupo</h3>
          <p className="text-sm text-ink-500">
            Pide el código a quien organiza la quiniela e ingrésalo aquí. Mientras tanto puedes
            seguir llenando tus pronósticos.
          </p>
        </div>
        <CodeForm pendingLabel="Uniendo…" />
      </section>
    );
  }

  return (
    <details className="group rounded-xl border border-line bg-pitch-900 px-4 py-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-ink-500 transition hover:text-volt-400">
        <span className="group-open:hidden">+ Unirse a otro grupo</span>
        <span className="hidden group-open:inline">Ingresa el código del grupo</span>
      </summary>
      <div className="pt-3">
        <CodeForm pendingLabel="Uniendo…" />
      </div>
    </details>
  );
}
