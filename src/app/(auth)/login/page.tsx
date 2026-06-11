"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "@/lib/actions/auth";
import { FormError, SubmitButton, TextField } from "../fields";

const initialState: AuthFormState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <section className="rounded-2xl border border-line bg-pitch-900/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <h2 className="mb-5 font-display text-xl font-bold">Entrar al vestidor</h2>
      <form action={formAction} className="space-y-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
        />
        <TextField
          label="Contraseña"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <FormError message={state.error} />
        <SubmitButton pending={pending} pendingText="Entrando…">
          Entrar
        </SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-ink-500">
        ¿Aún no juegas?{" "}
        <Link href="/registro" className="font-medium text-volt-400 hover:text-volt-300">
          Regístrate
        </Link>
      </p>
    </section>
  );
}
