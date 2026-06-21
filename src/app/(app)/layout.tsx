import { Suspense } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { getSession } from "@/lib/auth/session";
import { NavLinks } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConfettiProvider } from "@/components/confetti";

async function HeaderSession() {
  const session = await getSession();
  if (!session) return null;
  return (
    <>
      <Link
        href="/cuenta"
        className="max-w-[10rem] truncate text-xs text-ink-500 transition hover:text-ink-100"
      >
        {session.name}
      </Link>
      <ThemeToggle />
      <form action={logout}>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-500 transition hover:border-danger-400/60 hover:text-danger-400"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Salir</span>
        </button>
      </form>
    </>
  );
}

async function AdminNav({ mobile }: { mobile?: boolean }) {
  const session = await getSession();
  const isAdmin = session?.admin ?? false;
  if (mobile) {
    return (
      <div className="md:hidden">
        <NavLinks isAdmin={isAdmin} />
      </div>
    );
  }
  return (
    <div className="hidden md:block">
      <NavLinks isAdmin={isAdmin} />
    </div>
  );
}

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-24 md:pb-10">
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-pitch-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-6">
            <p className="font-display text-lg font-extrabold uppercase leading-none">
              <span className="text-volt-400">Q</span>M
              <span className="text-volt-400">26</span>
            </p>
            <Suspense fallback={null}>
              <AdminNav />
            </Suspense>
          </div>
          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <HeaderSession />
            </Suspense>
          </div>
        </div>
      </header>

      <ConfettiProvider>
        <main className="flex-1">{children}</main>
      </ConfettiProvider>

      <Suspense fallback={null}>
        <AdminNav mobile />
      </Suspense>
    </div>
  );
}
