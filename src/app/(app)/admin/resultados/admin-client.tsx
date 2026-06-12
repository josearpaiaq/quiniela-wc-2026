"use client";

import { useMemo, useState } from "react";
import { Check, PartyPopper } from "lucide-react";
import { ScoreStepper } from "@/components/score-stepper";
import { TeamLabel } from "@/components/team-label";
import {
  saveKnockoutOverride,
  saveOfficialResult,
  setMatchOpenOverride,
} from "@/lib/actions/admin";
import { MATCHES, TEAMS } from "@/lib/db/seed-data";
import { TEAM_ID_BY_CODE, type ScoreDTO, type ScoreRecord } from "@/lib/dto";
import { formatKickoff, shortVenue } from "@/lib/format";

export type AdminOverrideRecord = Record<
  number,
  { homeTeamId: number | null; awayTeamId: number | null }
>;

type Filter = "pending" | "done" | "all";

export function AdminClient({
  results: initialResults,
  realSlots,
  openOverrides,
  knockoutOverrides,
}: {
  results: ScoreRecord;
  realSlots: Record<number, { home: string | null; away: string | null }>;
  openOverrides: number[];
  knockoutOverrides: AdminOverrideRecord;
}) {
  const [results, setResults] = useState(initialResults);
  const [open, setOpen] = useState(() => new Set(openOverrides));
  const [filter, setFilter] = useState<Filter>("pending");

  const sorted = useMemo(
    () => [...MATCHES].sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt)),
    [],
  );

  // captured once per mount; "pending" filter is advisory UI, not authority
  const [now] = useState(() => Date.now());
  const filtered = sorted.filter((m) => {
    const hasResult = results[m.id] !== undefined;
    if (filter === "pending") return !hasResult && Date.parse(m.kickoffAt) <= now;
    if (filter === "done") return hasResult;
    return true;
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold uppercase">Cabina del admin</h2>
        <div className="flex rounded-lg border border-line p-0.5">
          {(
            [
              { key: "pending", label: "Por capturar" },
              { key: "done", label: "Capturados" },
              { key: "all", label: "Todos" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                filter === key ? "bg-volt-400 text-pitch-950" : "text-ink-500 hover:text-ink-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-bright px-4 py-8 text-center text-sm text-ink-500">
          {filter === "pending" ? (
            <span className="inline-flex items-center gap-1.5">
              No hay partidos jugados sin resultado.
              <PartyPopper aria-hidden className="h-4 w-4 text-volt-400" />
            </span>
          ) : (
            "Nada por aquí todavía."
          )}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((match) => (
          <AdminRow
            key={match.id}
            match={match}
            slot={
              match.phase === "group"
                ? { home: match.home!, away: match.away! }
                : (realSlots[match.id] ?? { home: null, away: null })
            }
            result={results[match.id]}
            isOpen={open.has(match.id)}
            override={knockoutOverrides[match.id]}
            onSaved={(score) => setResults((r) => ({ ...r, [match.id]: score }))}
            onToggleOpen={(value) =>
              setOpen((prev) => {
                const next = new Set(prev);
                if (value) next.add(match.id);
                else next.delete(match.id);
                return next;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function AdminRow({
  match,
  slot,
  result,
  isOpen,
  override,
  onSaved,
  onToggleOpen,
}: {
  match: (typeof MATCHES)[number];
  slot: { home: string | null; away: string | null };
  result: ScoreDTO | undefined;
  isOpen: boolean;
  override: { homeTeamId: number | null; awayTeamId: number | null } | undefined;
  onSaved: (score: ScoreDTO) => void;
  onToggleOpen: (open: boolean) => void;
}) {
  const [home, setHome] = useState<number | null>(result?.home ?? null);
  const [away, setAway] = useState<number | null>(result?.away ?? null);
  const [winner, setWinner] = useState<"home" | "away" | null>(result?.winnerSide ?? null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const isKnockout = match.phase !== "group";
  const isDraw = home !== null && away !== null && home === away;
  const complete = home !== null && away !== null && (!isKnockout || !isDraw || winner !== null);
  const dirty =
    home !== (result?.home ?? null) ||
    away !== (result?.away ?? null) ||
    (isKnockout && isDraw && winner !== (result?.winnerSide ?? null));

  async function save() {
    if (home === null || away === null) return;
    setStatus("saving");
    setError(null);
    const response = await saveOfficialResult({
      matchId: match.id,
      homeScore: home,
      awayScore: away,
      winnerSide: isDraw ? winner : null,
    });
    if (response.ok) {
      setStatus("saved");
      onSaved({ home, away, winnerSide: isDraw ? winner : null });
      setTimeout(() => setStatus("idle"), 1500);
    } else {
      setStatus("error");
      setError(response.error);
    }
  }

  return (
    <article className="rounded-xl border border-line bg-pitch-900 p-3.5">
      <header className="mb-2.5 flex items-center justify-between gap-2 text-[11px] text-ink-500">
        <span className="flex items-center gap-2">
          <span className="rounded bg-pitch-700 px-1.5 py-0.5 font-mono font-semibold text-ink-300">
            P{match.id}
          </span>
          <time suppressHydrationWarning>{formatKickoff(match.kickoffAt)}</time>
          <span className="hidden sm:inline">· {shortVenue(match.venue)}</span>
        </span>
        <label className="flex cursor-pointer items-center gap-1.5">
          <span className={isOpen ? "text-gold-400" : ""}>
            {isOpen ? "abierto (override)" : "candado normal"}
          </span>
          <input
            type="checkbox"
            checked={isOpen}
            onChange={async (e) => {
              const value = e.target.checked;
              onToggleOpen(value);
              const response = await setMatchOpenOverride({ matchId: match.id, open: value });
              if (!response.ok) onToggleOpen(!value);
            }}
            className="h-3.5 w-3.5 accent-gold-400"
          />
        </label>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamLabel code={slot.home} />
        <div className="flex items-center gap-1.5">
          <ScoreStepper label="local" value={home} onChange={setHome} disabled={!slot.home} />
          <span className="font-mono text-ink-500">–</span>
          <ScoreStepper label="visitante" value={away} onChange={setAway} disabled={!slot.away} />
        </div>
        <TeamLabel code={slot.away} align="right" />
      </div>

      {isKnockout && isDraw && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["home", "away"] as const).map((side) => {
            const code = side === "home" ? slot.home : slot.away;
            if (!code) return null;
            return (
              <button
                key={side}
                type="button"
                onClick={() => setWinner(side)}
                className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                  winner === side
                    ? "border-gold-400 bg-gold-400/15 text-gold-400"
                    : "border-line text-ink-300"
                }`}
              >
                Avanza en penales
              </button>
            );
          })}
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs">
          {status === "saved" && (
            <span className="inline-flex items-center gap-1 text-volt-400">
              <Check aria-hidden className="h-3 w-3" /> resultado guardado
            </span>
          )}
          {status === "error" && <span className="text-danger-400">{error}</span>}
        </span>
        <button
          type="button"
          disabled={!complete || !dirty || status === "saving"}
          onClick={save}
          className="rounded-lg bg-volt-400 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-pitch-950 transition enabled:hover:bg-volt-300 disabled:opacity-40"
        >
          {status === "saving" ? "Guardando…" : result ? "Corregir" : "Guardar"}
        </button>
      </footer>

      {isKnockout && <OverrideEditor matchId={match.id} override={override} slot={slot} />}
    </article>
  );
}

function OverrideEditor({
  matchId,
  override,
  slot,
}: {
  matchId: number;
  override: { homeTeamId: number | null; awayTeamId: number | null } | undefined;
  slot: { home: string | null; away: string | null };
}) {
  const [homeTeamId, setHomeTeamId] = useState<number | null>(
    override?.homeTeamId ?? (slot.home ? (TEAM_ID_BY_CODE.get(slot.home) ?? null) : null),
  );
  const [awayTeamId, setAwayTeamId] = useState<number | null>(
    override?.awayTeamId ?? (slot.away ? (TEAM_ID_BY_CODE.get(slot.away) ?? null) : null),
  );
  const [message, setMessage] = useState<string | null>(null);
  const hasOverride = override !== undefined;

  async function apply(home: number | null, away: number | null) {
    const response = await saveKnockoutOverride({ matchId, homeTeamId: home, awayTeamId: away });
    setMessage(response.ok ? "Cruce actualizado — recarga para ver el efecto" : response.error);
  }

  return (
    <details className="mt-3 border-t border-line/60 pt-2">
      <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-ink-500 hover:text-gold-400">
        Corregir cruce manualmente {hasOverride && <span className="text-gold-400">· activo</span>}
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <TeamSelect value={homeTeamId} onChange={setHomeTeamId} label="Local" />
        <span className="text-ink-500">vs</span>
        <TeamSelect value={awayTeamId} onChange={setAwayTeamId} label="Visitante" />
        <button
          type="button"
          onClick={() => apply(homeTeamId, awayTeamId)}
          className="rounded-lg border border-gold-400/50 px-3 py-1.5 text-xs text-gold-400 transition hover:bg-gold-400/10"
        >
          Aplicar
        </button>
        {hasOverride && (
          <button
            type="button"
            onClick={() => apply(null, null)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-500 hover:text-danger-400"
          >
            Quitar corrección
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-xs text-ink-500">{message}</p>}
    </details>
  );
}

function TeamSelect({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="rounded-lg border border-line bg-pitch-800 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-gold-400"
    >
      <option value="">— sin definir —</option>
      {TEAMS.map((team, index) => (
        <option key={team.code} value={index + 1}>
          {team.flag} {team.name}
        </option>
      ))}
    </select>
  );
}
