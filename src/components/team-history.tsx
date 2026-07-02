"use client";

import { createContext, useCallback, useContext, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { TEAM_BY_CODE } from "@/lib/dto";
import type { Phase } from "@/lib/db/seed-data";
import type { TeamHistoryEntry } from "@/lib/tournament/team-history";

const PHASE_LABELS: Record<Phase, string> = {
  group: "Fase de grupos",
  r32: "Dieciseisavos de final",
  r16: "Octavos de final",
  qf: "Cuartos de final",
  sf: "Semifinales",
  third: "Tercer puesto",
  final: "Final",
};

type TeamHistoryCtx = { open: (code: string) => void };
const TeamHistoryContext = createContext<TeamHistoryCtx | null>(null);

/** Returns null when no TeamHistoryProvider is mounted above the caller. */
export function useTeamHistory() {
  return useContext(TeamHistoryContext);
}

export function TeamHistoryProvider({
  histories,
  children,
}: {
  histories: ReadonlyMap<string, TeamHistoryEntry[]>;
  children: React.ReactNode;
}) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const open = useCallback((code: string) => setOpenCode(code), []);
  const entries = openCode ? (histories.get(openCode) ?? []) : [];

  return (
    <TeamHistoryContext.Provider value={{ open }}>
      {children}
      <TeamHistoryModal
        teamCode={openCode}
        entries={entries}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpenCode(null);
        }}
      />
    </TeamHistoryContext.Provider>
  );
}

function groupByPhase(
  entries: TeamHistoryEntry[],
): { phase: Phase; rows: TeamHistoryEntry[] }[] {
  const groups: { phase: Phase; rows: TeamHistoryEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.phase === entry.phase) last.rows.push(entry);
    else groups.push({ phase: entry.phase, rows: [entry] });
  }
  return groups;
}

function PointsBadge({ points }: { points: number | null }) {
  if (points === null) {
    return <span className="text-[11px] italic text-ink-500">Sin pronóstico</span>;
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
        points > 1
          ? "bg-volt-400/15 text-volt-400"
          : points === 1
            ? "bg-gold-400/15 text-gold-400"
            : "bg-pitch-700 text-ink-500"
      }`}
    >
      +{points} pts
    </span>
  );
}

function TeamHistoryModal({
  teamCode,
  entries,
  onOpenChange,
}: {
  teamCode: string | null;
  entries: TeamHistoryEntry[];
  onOpenChange: (open: boolean) => void;
}) {
  const team = teamCode ? TEAM_BY_CODE.get(teamCode) : null;

  return (
    <Dialog.Root open={teamCode !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="team-history-overlay fixed inset-0 z-40 bg-pitch-950/70 backdrop-blur-sm" />
        <Dialog.Content
          className="team-history-content fixed inset-x-0 bottom-0 z-50 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-pitch-900 p-4 shadow-2xl outline-none md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[80vh] md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
        >
          {team && (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <Dialog.Title className="flex items-center gap-2 font-display text-base font-bold">
                  <span aria-hidden className="text-2xl leading-none">
                    {team.flag}
                  </span>
                  {team.name}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Cerrar"
                    className="rounded-md p-1 text-ink-500 transition hover:bg-pitch-800 hover:text-ink-100"
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="mb-3 text-xs text-ink-500">
                Grupo {team.group} · partidos jugados
              </Dialog.Description>

              {entries.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-ink-500">
                  Aún no ha jugado ningún partido.
                </p>
              ) : (
                <div className="space-y-4">
                  {groupByPhase(entries).map(({ phase, rows }) => (
                    <div key={phase}>
                      <p className="mb-1.5 font-display text-[11px] font-bold uppercase tracking-widest text-ink-500">
                        {PHASE_LABELS[phase]}
                      </p>
                      <div className="space-y-1.5">
                        {rows.map((entry) => {
                          const opponent = TEAM_BY_CODE.get(entry.opponentCode);
                          return (
                            <div
                              key={entry.matchId}
                              className="flex items-center justify-between gap-2 rounded-lg border border-line/60 bg-pitch-800/50 px-2.5 py-2"
                            >
                              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                                <span aria-hidden>{opponent?.flag}</span>
                                <span className="truncate">{opponent?.name}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2 text-xs">
                                <span className="font-mono font-semibold text-ink-100">
                                  {entry.teamScore}–{entry.opponentScore}
                                </span>
                                {entry.predictedTeamScore !== null && (
                                  <span className="font-mono text-ink-500">
                                    (tu: {entry.predictedTeamScore}–{entry.predictedOpponentScore})
                                  </span>
                                )}
                                <PointsBadge points={entry.points} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
