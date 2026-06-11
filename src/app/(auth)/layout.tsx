export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10">
      {/* pitch center-circle motif */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-2/3 rounded-full border border-line"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-2/3 rounded-full border border-line"
      />

      <header className="rise-in mb-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-volt-400">
          Canadá · México · Estados Unidos
        </p>
        <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none tracking-tight">
          La Quiniela
          <span className="block text-volt-400">Mundial 26</span>
        </h1>
        <p className="mt-3 text-sm text-ink-500">
          104 partidos · 12 grupos · un solo campeón de la tabla
        </p>
      </header>

      <div className="rise-in w-full max-w-sm" style={{ animationDelay: "0.08s" }}>
        {children}
      </div>
    </main>
  );
}
