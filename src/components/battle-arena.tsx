"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  addPendingClick,
  BATTLE_CLOSE_AFTER_KICKOFF_MS,
  takeFlushBatch,
  type SideCounts,
} from "@/lib/battle/rules";
import { TEAM_BY_CODE } from "@/lib/dto";

const FLUSH_TICK_MS = 3000;
const POLL_LIVE_MS = 3000;
const POLL_PREMATCH_MS = 15000;

const formatTotal = (n: number) => n.toLocaleString("es");

interface BattleUser {
  userId: string;
  name: string;
  home: number;
  away: number;
}

type BattleState = SideCounts & { users: BattleUser[] };

export function BattleArena({
  matchId,
  homeCode,
  awayCode,
  kickoffAt,
  open,
  initialTotals,
  viewerId,
}: {
  matchId: number;
  homeCode: string;
  awayCode: string;
  kickoffAt: string;
  open: boolean;
  initialTotals: SideCounts;
  viewerId: string;
}) {
  const [serverTotals, setServerTotals] = useState<SideCounts>(initialTotals);
  const [pending, setPending] = useState<SideCounts>({ home: 0, away: 0 });
  const [closed, setClosed] = useState(!open);
  // null = not fetched yet; loaded lazily when the disclosure opens
  const [users, setUsers] = useState<BattleUser[] | null>(null);
  const [showUsers, setShowUsers] = useState(false);

  const kickoffMs = useMemo(() => new Date(kickoffAt).getTime(), [kickoffAt]);
  const closesAt = kickoffMs + BATTLE_CLOSE_AFTER_KICKOFF_MS;

  // the tick reads through refs so the interval callback never goes stale
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const inFlightRef = useRef(false);
  const lastFlushAtRef = useRef(0);
  const lastPollAtRef = useRef(0);

  useEffect(() => {
    if (closed) return;

    async function tick() {
      // paused in background tabs; the local counter is advisory, the server re-validates
      if (document.hidden || inFlightRef.current) return;
      const now = Date.now();
      if (now >= closesAt) {
        // unflushed clicks are dropped so the frozen bar only shows server truth
        setPending({ home: 0, away: 0 });
        setClosed(true);
        return;
      }

      const current = pendingRef.current;
      if (current.home + current.away > 0) {
        // clicker path: flush the batch — its response is our scoreboard update
        const { batch, rest } = takeFlushBatch(current);
        setPending(rest);
        inFlightRef.current = true;
        try {
          const res = await fetch(`/api/battle/${matchId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          });
          if (!res.ok) throw new Error(String(res.status));
          const data: { accepted: boolean } & BattleState = await res.json();
          lastFlushAtRef.current = Date.now();
          setServerTotals({ home: data.home, away: data.away });
          setUsers(data.users);
          if (!data.accepted) {
            // rate-limited (another tab?) — clicks go back to the queue
            setPending((p) => ({ home: p.home + batch.home, away: p.away + batch.away }));
          }
        } catch {
          // transient failure: clicks are never lost, retry next tick
          setPending((p) => ({ home: p.home + batch.home, away: p.away + batch.away }));
        } finally {
          inFlightRef.current = false;
        }
        return;
      }

      // viewer path: poll the CDN-cached scoreboard
      const cadence = now >= kickoffMs ? POLL_LIVE_MS : POLL_PREMATCH_MS;
      if (now - lastFlushAtRef.current < FLUSH_TICK_MS) return; // flush response is fresh
      if (now - lastPollAtRef.current < cadence - 500) return; // -500: interval jitter
      lastPollAtRef.current = now;
      inFlightRef.current = true;
      try {
        const res = await fetch(`/api/battle/${matchId}`);
        if (res.ok) {
          const data: BattleState = await res.json();
          setServerTotals({ home: data.home, away: data.away });
          setUsers(data.users);
        }
      } catch {
        // polling is best-effort
      } finally {
        inFlightRef.current = false;
      }
    }

    const id = setInterval(tick, FLUSH_TICK_MS);
    return () => clearInterval(id);
  }, [closed, closesAt, kickoffMs, matchId]);

  const home = TEAM_BY_CODE.get(homeCode);
  const away = TEAM_BY_CODE.get(awayCode);
  if (!home || !away) return null;

  const totals = {
    home: serverTotals.home + pending.home,
    away: serverTotals.away + pending.away,
  };
  const total = totals.home + totals.away;
  const homePct = total === 0 ? 50 : (totals.home / total) * 100;
  const winner = totals.home === totals.away ? null : totals.home > totals.away ? "home" : "away";

  // no close check here: the tick closes the arena within one interval anyway
  function handleClick(side: "home" | "away") {
    setPending((p) => addPendingClick(p, side));
  }

  async function toggleUsers() {
    const next = !showUsers;
    setShowUsers(next);
    if (!next || users !== null) return;
    // first open (or closed battle, where no loops run): fetch once
    try {
      const res = await fetch(`/api/battle/${matchId}`);
      if (res.ok) {
        const data: BattleState = await res.json();
        setServerTotals({ home: data.home, away: data.away });
        setUsers(data.users);
      }
    } catch {
      // best-effort; the list just stays in its loading state
    }
  }

  // viewer's row first, fixed — same pattern as the predictions list
  const own = users?.find((u) => u.userId === viewerId);
  const userRows = users ? (own ? [own, ...users.filter((u) => u !== own)] : users) : null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Battle</h3>
        {closed ? (
          <span className="rounded-full bg-pitch-700 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-500">
            Battle terminado
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] uppercase text-volt-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-volt-400" />
          </span>
        )}
      </div>

      <div className="rounded-xl border border-line bg-pitch-900 p-4">
        {!closed && (
          <p className="mb-3 text-center text-[11px] text-ink-500">
            Toca tu equipo para darle puntos
          </p>
        )}

        <div className="flex items-stretch gap-3">
          {(["home", "away"] as const).map((side) => {
            const team = side === "home" ? home : away;
            const isWinner = closed && winner === side;
            return (
              <div key={side} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                {closed ? (
                  <div
                    className={`flex w-full flex-col items-center gap-1 rounded-xl border px-3 py-4 ${
                      isWinner
                        ? "border-volt-400/40 bg-volt-400/10"
                        : "border-line opacity-60"
                    }`}
                  >
                    <span className="text-3xl leading-none">{team.flag}</span>
                    <span className="truncate text-sm font-medium">{team.name}</span>
                    {isWinner && (
                      <span className="text-[10px] font-semibold uppercase text-volt-400">
                        Ganador
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={`Dar un punto a ${team.name}`}
                    onClick={() => handleClick(side)}
                    className="flex w-full cursor-pointer select-none flex-col items-center gap-1 rounded-xl border border-line bg-pitch-700/40 px-3 py-4 transition-transform duration-75 hover:border-volt-400/40 active:scale-90"
                  >
                    <span className="text-3xl leading-none">{team.flag}</span>
                    <span className="truncate text-sm font-medium">{team.name}</span>
                  </button>
                )}
                <span className="font-mono text-lg font-bold tabular-nums">
                  {formatTotal(totals[side])}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-pitch-700">
          <div
            className="bg-battle-home transition-all duration-500"
            style={{ width: `${homePct}%` }}
          />
          <div
            className="bg-battle-away transition-all duration-500"
            style={{ width: `${100 - homePct}%` }}
          />
        </div>

        <button
          type="button"
          onClick={toggleUsers}
          aria-expanded={showUsers}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1 text-[11px] text-ink-500 transition hover:text-volt-400"
        >
          Clicks por usuario
          <ChevronDown
            aria-hidden
            className={`h-3.5 w-3.5 transition-transform ${showUsers ? "rotate-180" : ""}`}
          />
        </button>

        {showUsers && (
          <div className="mt-2 space-y-1.5">
            {userRows === null ? (
              <p className="py-2 text-center text-xs text-ink-500">Cargando…</p>
            ) : userRows.length === 0 ? (
              <p className="py-2 text-center text-xs text-ink-500">Nadie ha clickeado todavía.</p>
            ) : (
              userRows.map((u) => {
                const isOwn = u.userId === viewerId;
                return (
                  <div
                    key={u.userId}
                    className={`flex items-center justify-between gap-2 rounded-lg border border-line bg-pitch-900 px-3 py-2 text-sm ${isOwn ? "sticky top-15 z-10 bg-linear-to-b from-volt-400/10 to-volt-400/10" : ""}`}
                  >
                    <span className="min-w-0 truncate">
                      {u.name}
                      {isOwn && (
                        <span className="ml-2 text-[10px] uppercase text-volt-400">tú</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-ink-300">
                      {home.flag} {formatTotal(u.home)} · {away.flag} {formatTotal(u.away)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
}
