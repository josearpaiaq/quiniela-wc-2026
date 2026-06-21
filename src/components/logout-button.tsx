"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";

export function LogoutButton() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("¿Cerrar sesión?")) {
      e.preventDefault();
    }
  }

  return (
    <form action={logout} onSubmit={handleSubmit}>
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-500 transition hover:border-danger-400/60 hover:text-danger-400"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Salir</span>
      </button>
    </form>
  );
}
