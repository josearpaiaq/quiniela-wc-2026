"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-6 text-center">
      <div>
        <p className="font-display text-5xl font-extrabold text-ink-500">⚠️</p>
        <h2 className="mt-3 font-display text-xl font-bold">Se cayó el sistema VAR</h2>
        <p className="mt-2 text-sm text-ink-500">
          No pudimos cargar los datos. Revisa tu conexión e intenta de nuevo.
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-lg bg-volt-400 px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-volt-300"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
