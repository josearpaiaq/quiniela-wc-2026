"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register, type AuthFormState } from "@/lib/actions/auth";
import { FormError, SubmitButton, TextField } from "../fields";

const initialState: AuthFormState = { error: null };

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <section className="rounded-2xl border border-line bg-pitch-900/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <h2 className="mb-5 font-display text-xl font-bold">Ficha tu lugar</h2>
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Nombre" name="firstName" placeholder="José" autoComplete="given-name" />
          <TextField
            label="Apellido"
            name="lastName"
            placeholder="Arpaia"
            autoComplete="family-name"
          />
        </div>
        <TextField
          label="Alias en la tabla (opcional)"
          name="displayName"
          placeholder="El Míster"
          required={false}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
        />
        <TextField
          label="Contraseña (mínimo 8)"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <FormError message={state.error} />
        <SubmitButton pending={pending} pendingText="Creando cuenta…">
          Crear cuenta
        </SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-ink-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-volt-400 hover:text-volt-300">
          Entra aquí
        </Link>
      </p>
    </section>
  );
}
