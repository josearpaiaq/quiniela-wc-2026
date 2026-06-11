"use client";

// Big tappable scoreboard digit with +/- steppers, mobile-first.
export function ScoreStepper({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: number | null;
  onChange: (next: number) => void;
  disabled?: boolean;
  label: string;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(99, n));

  if (disabled) {
    return (
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-pitch-800 font-mono text-xl font-semibold text-ink-300">
        {value ?? "·"}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`Subir goles ${label}`}
        onClick={() => onChange(clamp((value ?? 0) + (value === null ? 0 : 1)))}
        className="flex h-6 w-11 items-center justify-center rounded-md border border-line text-ink-500 transition hover:border-volt-400 hover:text-volt-400 active:scale-95"
      >
        +
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        aria-label={`Goles ${label}`}
        value={value ?? ""}
        placeholder="·"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return;
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(clamp(Math.trunc(n)));
        }}
        className={`h-11 w-11 rounded-lg border bg-pitch-800 text-center font-mono text-xl font-semibold outline-none transition focus:border-volt-400 focus:ring-2 focus:ring-volt-400/25 ${
          value === null ? "border-line-bright border-dashed" : "border-line"
        }`}
      />
      <button
        type="button"
        aria-label={`Bajar goles ${label}`}
        onClick={() => onChange(clamp((value ?? 1) - 1))}
        className="flex h-6 w-11 items-center justify-center rounded-md border border-line text-ink-500 transition hover:border-volt-400 hover:text-volt-400 active:scale-95"
      >
        −
      </button>
    </div>
  );
}
