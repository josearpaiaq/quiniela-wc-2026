"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const inputClassName =
  "w-full rounded-lg border border-line bg-pitch-800 px-3.5 py-2.5 text-ink-100 placeholder:text-ink-500/60 outline-none transition focus:border-volt-400 focus:ring-2 focus:ring-volt-400/25";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
      {children}
    </span>
  );
}

export function TextField({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
}: {
  label: string;
  name: string;
  type?: "text" | "email";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={inputClassName}
      />
    </label>
  );
}

export function PasswordField({
  label,
  name,
  placeholder,
  autoComplete = "current-password",
  required = true,
}: {
  label: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          name={name}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className={`${inputClassName} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-ink-500 transition hover:text-ink-100"
        >
          {showPassword ? (
            <EyeOff aria-hidden className="h-5 w-5" />
          ) : (
            <Eye aria-hidden className="h-5 w-5" />
          )}
        </button>
      </div>
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-danger-400/40 bg-danger-400/10 px-3 py-2 text-sm text-danger-400"
    >
      {message}
    </p>
  );
}

export function SubmitButton({
  children,
  pending,
  pendingText,
}: {
  children: React.ReactNode;
  pending: boolean;
  pendingText: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-volt-400 py-3 font-display text-sm font-bold uppercase tracking-[0.15em] text-pitch-950 transition hover:bg-volt-300 active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  );
}
