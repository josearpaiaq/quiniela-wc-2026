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
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
        {label}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-lg border border-line bg-pitch-800 px-3.5 py-2.5 text-ink-100 placeholder:text-ink-500/60 outline-none transition focus:border-volt-400 focus:ring-2 focus:ring-volt-400/25"
      />
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
