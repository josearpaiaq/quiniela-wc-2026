"use client";

import { useState } from "react";
import { TeamLabel } from "@/components/team-label";
import { formatKickoff } from "@/lib/format";

export type PredictionCard = {
  id: number;
  kickoffAt: string;
  homeCode: string | null;
  awayCode: string | null;
  predictedHome: number;
  predictedAway: number;
  realHome: number | null;
  realAway: number | null;
  points: number | undefined;
};

type Filter = "all" | "scored" | "exact";

export function PredictionList({ cards }: { cards: PredictionCard[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = cards.filter((c) => {
    if (filter === "scored") return c.points !== undefined && c.points > 0;
    if (filter === "exact") return c.points === 3;
    return true;
  });

  const scoredCount = cards.filter((c) => c.points !== undefined && c.points > 0).length;
  const exactCount = cards.filter((c) => c.points === 3).length;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
          Pronósticos visibles ({cards.length})
        </h3>
        <div className="flex rounded-lg border border-line p-0.5">
          {(
            [
              { key: "all", label: "Todos" },
              { key: "scored", label: `Con puntos (${scoredCount})` },
              { key: "exact", label: `+3 exactos (${exactCount})` },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                filter === key
                  ? "bg-volt-400 text-pitch-950"
                  : "text-ink-500 hover:text-ink-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-bright px-4 py-6 text-center text-sm text-ink-500">
          {filter === "scored"
            ? "Ningún pronóstico con puntos aún."
            : filter === "exact"
              ? "Ningún pronóstico exacto aún."
              : "Todavía no hay pronósticos visibles."}
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
                  card.points === 3
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
            <span className="text-center">
              <span className="font-mono font-semibold">
                {card.predictedHome}–{card.predictedAway}
              </span>
              {card.realHome !== null && (
                <span className="block font-mono text-[11px] text-ink-500">
                  real {card.realHome}–{card.realAway}
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
