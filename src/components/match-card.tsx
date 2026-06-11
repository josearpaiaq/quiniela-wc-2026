"use client";

import Link from "next/link";
import { ScoreStepper } from "./score-stepper";
import { TeamLabel } from "./team-label";
import { TEAM_BY_CODE, type ScoreDTO } from "@/lib/dto";
import { formatKickoff, shortVenue } from "@/lib/format";
import type { Phase } from "@/lib/db/seed-data";

export type SaveStatus = "saving" | "saved" | "error" | "pendingWinner" | null;

export function MatchCard({
  phase,
  kickoffAt,
  venue,
  tag,
  homeCode,
  awayCode,
  score,
  open,
  saveStatus,
  result,
  groupPoints,
  detailsHref,
  onScore,
  onWinner,
}: {
  phase: Phase;
  kickoffAt: string;
  venue: string;
  /** small leading label, e.g. "P12" or "3er puesto" */
  tag: string;
  homeCode: string | null;
  awayCode: string | null;
  score: ScoreDTO | undefined;
  open: boolean;
  saveStatus: SaveStatus;
  result: ScoreDTO | undefined;
  groupPoints: number | null;
  /** when set (locked matches), links to the everyone's-predictions page */
  detailsHref?: string;
  onScore: (side: "home" | "away", value: number) => void;
  onWinner: (side: "home" | "away") => void;
}) {
  const isKnockout = phase !== "group";
  const isDraw = score !== undefined && score.home === score.away;
  const needsWinner = isKnockout && isDraw && open;
  const editable = open && homeCode !== null && awayCode !== null;

  return (
    <article
      className={`rounded-xl border bg-pitch-900 p-3.5 transition ${
        saveStatus === "saved" ? "saved-flash" : ""
      } ${open ? "border-line" : "locked-stripes border-line/70"}`}
    >
      <header className="mb-2.5 flex items-center justify-between gap-2 text-[11px] text-ink-500">
        <span className="flex items-center gap-2">
          <span className="rounded bg-pitch-700 px-1.5 py-0.5 font-mono font-semibold text-ink-300">
            {tag}
          </span>
          <time suppressHydrationWarning>{formatKickoff(kickoffAt)}</time>
          <span className="hidden sm:inline">· {shortVenue(venue)}</span>
        </span>
        <span className="font-mono">
          {saveStatus === "saving" && <span className="text-ink-500">···</span>}
          {saveStatus === "saved" && <span className="text-volt-400">✓ guardado</span>}
          {saveStatus === "error" && <span className="text-danger-400">no guardado</span>}
          {!open && <span aria-label="bloqueado">🔒</span>}
        </span>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamLabel code={homeCode} />
        <div className="flex items-center gap-1.5">
          <ScoreStepper
            label={homeCode ?? "local"}
            value={score?.home ?? null}
            disabled={!editable}
            onChange={(n) => onScore("home", n)}
          />
          <span className="font-mono text-ink-500">–</span>
          <ScoreStepper
            label={awayCode ?? "visitante"}
            value={score?.away ?? null}
            disabled={!editable}
            onChange={(n) => onScore("away", n)}
          />
        </div>
        <TeamLabel code={awayCode} align="right" />
      </div>

      {needsWinner && homeCode && awayCode && (
        <div className="mt-3 rounded-lg border border-gold-400/30 bg-gold-400/5 p-2.5">
          <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wider text-gold-400">
            Empate · ¿quién avanza en penales?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["home", "away"] as const).map((side) => {
              const code = side === "home" ? homeCode : awayCode;
              const team = TEAM_BY_CODE.get(code);
              const selected = score?.winnerSide === side;
              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => onWinner(side)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition active:scale-[0.98] ${
                    selected
                      ? "border-gold-400 bg-gold-400/15 text-gold-400"
                      : "border-line text-ink-300 hover:border-gold-400/50"
                  }`}
                >
                  {team?.flag} {team?.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!open && (result || detailsHref) && (
        <footer className="mt-2.5 flex items-center justify-center gap-2 border-t border-line/60 pt-2 text-xs">
          {result && (
            <span className="text-ink-500">
              Real: <span className="font-mono font-semibold text-ink-100">{result.home}–{result.away}</span>
            </span>
          )}
          {result && phase === "group" && groupPoints !== null && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono font-semibold ${
                groupPoints === 3
                  ? "bg-volt-400/15 text-volt-400"
                  : groupPoints === 1
                    ? "bg-gold-400/15 text-gold-400"
                    : "bg-pitch-700 text-ink-500"
              }`}
            >
              +{groupPoints} pts
            </span>
          )}
          {detailsHref && (
            <Link href={detailsHref} className="text-ink-500 underline-offset-2 hover:text-volt-400 hover:underline">
              Ver pronósticos de todos →
            </Link>
          )}
        </footer>
      )}
    </article>
  );
}
