"use client";

import { useState } from "react";
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";
import { PenaltyBadge } from "@/components/penalty-badge";
import { TeamLabel } from "@/components/team-label";
import { formatKickoff } from "@/lib/format";
import type { Phase } from "@/lib/db/seed-data";
import type { Side } from "@/lib/tournament";

export type PredictionCard = {
  id: number;
  phase: Phase;
  kickoffAt: string;
  homeCode: string | null;
  awayCode: string | null;
  predictedHome: number;
  predictedAway: number;
  realHome: number | null;
  realAway: number | null;
  realWinnerSide: Side | null;
  points: number | undefined;
};

type Filter = "all" | "exact" | Phase;
type Order = "asc" | "desc";

const PHASE_LABELS: Record<Phase, string> = {
  group: "Grupos",
  r32: "16avos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semis",
  third: "3er puesto",
  final: "Final",
};

function isExactMatch(card: PredictionCard) {
  return (
    card.realHome !== null &&
    card.realAway !== null &&
    card.predictedHome === card.realHome &&
    card.predictedAway === card.realAway
  );
}

export function PredictionList({ cards }: { cards: PredictionCard[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [order, setOrder] = useState<Order>("desc");

  const phases = [...new Set(cards.map((c) => c.phase))].filter(
    (p): p is Exclude<Phase, "group"> | "group" => true,
  );

  const pointsByPhase = new Map<Phase, number>();
  for (const card of cards) {
    if (card.points !== undefined && card.points > 0) {
      pointsByPhase.set(card.phase, (pointsByPhase.get(card.phase) ?? 0) + card.points);
    }
  }

  const exactCount = cards.filter(isExactMatch).length;

  const filtered = (
    filter === "all"
      ? cards
      : filter === "exact"
        ? cards.filter(isExactMatch)
        : cards.filter((c) => c.phase === filter)
  )
    .slice()
    .sort((a, b) =>
      order === "asc"
        ? Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt)
        : Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt),
    );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Pronósticos visibles ({cards.length})
        </h3>
        <button
          type="button"
          onClick={() => setOrder(order === "desc" ? "asc" : "desc")}
          aria-label={
            order === "desc" ? "Ordenar del más antiguo al más reciente" : "Ordenar del más reciente al más antiguo"
          }
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line text-ink-500 transition hover:border-line-bright hover:text-ink-300 cursor-pointer"
        >
          {order === "desc" ? (
            <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowUpWideNarrow className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
            filter === "all"
              ? "bg-volt-400 text-pitch-950"
              : "text-ink-500 hover:text-ink-300"
          }`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setFilter("exact")}
          className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
            filter === "exact"
              ? "bg-volt-400 text-pitch-950"
              : "text-ink-500 hover:text-ink-300"
          }`}
        >
          Marcador exacto
          <span className={`ml-1 font-mono ${filter === "exact" ? "text-pitch-950/70" : "text-volt-400"}`}>
            {exactCount}
          </span>
        </button>
        {phases.map((phase) => {
          const pts = pointsByPhase.get(phase);
          return (
            <button
              key={phase}
              type="button"
              onClick={() => setFilter(phase)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                filter === phase
                  ? "bg-volt-400 text-pitch-950"
                  : "text-ink-500 hover:text-ink-300"
              }`}
            >
              {PHASE_LABELS[phase]}
              {pts !== undefined && (
                <span className={`ml-1 font-mono ${filter === phase ? "text-pitch-950/70" : "text-volt-400"}`}>
                  {pts}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-bright px-4 py-6 text-center text-sm text-ink-500">
          {filter === "exact"
            ? "Todavía no ha pegado ningún marcador exacto."
            : "Todavía no hay pronósticos visibles en esta fase."}
        </p>
      )}

      {filtered.map((card) => (
        <div
          key={card.id}
          className="space-y-2 rounded-lg border border-line bg-pitch-900 px-3 py-2.5 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="rounded bg-pitch-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">
                P{card.id}
              </span>
              <span className="truncate text-xs text-ink-500" suppressHydrationWarning>
                {formatKickoff(card.kickoffAt)}
              </span>
            </span>
            {card.points !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                  card.points > 1
                    ? "bg-volt-400/15 text-volt-400"
                    : card.points === 1
                      ? "bg-gold-400/15 text-gold-400"
                      : "bg-pitch-700 text-ink-500"
                }`}
              >
                +{card.points}
              </span>
            )}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <TeamLabel code={card.homeCode} />
            <span className="whitespace-nowrap text-center">
              <span className="font-mono font-semibold">
                {card.predictedHome}–{card.predictedAway}
              </span>
              {card.realHome !== null && (
                <span className="block font-mono text-[11px] text-ink-500">
                  real {card.realHome}–{card.realAway}{" "}
                  <PenaltyBadge
                    winnerSide={card.realWinnerSide}
                    homeCode={card.homeCode}
                    awayCode={card.awayCode}
                  />
                </span>
              )}
            </span>
            <TeamLabel code={card.awayCode} align="right" />
          </div>
        </div>
      ))}
    </section>
  );
}
