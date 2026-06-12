"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Trophy } from "lucide-react";
import { MATCHES, type GroupLetter, type Phase } from "@/lib/db/seed-data";
import {
  PHASES,
  TEAM_BY_CODE,
  toScoreMap,
  type ScoreDTO,
  type ScoreRecord,
} from "@/lib/dto";
import {
  GROUP_LETTERS,
  allGroupsComplete,
  buildBracket,
  computeGroupStandings,
  groupMatchPoints,
} from "@/lib/tournament";
import { isSameLocalDay } from "@/lib/format";
import { savePrediction } from "@/lib/actions/predictions";
import { MatchCard, type SaveStatus } from "@/components/match-card";

type PhaseKey = Phase | "finals";

const GROUP_MATCH_IDS = MATCHES.filter((m) => m.phase === "group").map((m) => m.id);

function matchTag(match: (typeof MATCHES)[number]): React.ReactNode {
  if (match.phase === "third") return "3er puesto";
  if (match.phase === "final") {
    return (
      <span className="inline-flex items-center gap-1">
        <Trophy aria-hidden className="h-3 w-3 text-gold-400" /> Final
      </span>
    );
  }
  return `P${match.id}`;
}

export function QuinielaClient({
  initialPredictions,
  results,
  openOverrides,
}: {
  initialPredictions: ScoreRecord;
  results: ScoreRecord;
  openOverrides: number[];
}) {
  const [predictions, setPredictions] = useState<ScoreRecord>(initialPredictions);
  const [tab, setTab] = useState<PhaseKey>("group");
  const [group, setGroup] = useState<GroupLetter>("A");
  const [saveStatus, setSaveStatus] = useState<Record<number, SaveStatus>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const overrides = useMemo(() => new Set(openOverrides), [openOverrides]);

  const scoreMap = useMemo(() => toScoreMap(predictions), [predictions]);
  const bracket = useMemo(() => buildBracket(scoreMap), [scoreMap]);
  const bracketReady = useMemo(() => allGroupsComplete(scoreMap), [scoreMap]);

  const groupFilled = useMemo(
    () => GROUP_MATCH_IDS.filter((id) => predictions[id] !== undefined).length,
    [predictions],
  );

  // captured once per mount: lock display is advisory, the server re-validates
  const [now] = useState(() => Date.now());

  // client-only: "today" depends on the viewer's timezone, so skip it on the
  // server render to avoid a hydration mismatch around midnight / other TZs
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const todayMatches = useMemo(
    () =>
      MATCHES.filter((m) => isSameLocalDay(new Date(m.kickoffAt), new Date(now))).sort(
        (a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt),
      ),
    [now],
  );
  const isOpen = (matchId: number, kickoffAt: string) =>
    overrides.has(matchId) || now < Date.parse(kickoffAt);

  function scheduleSave(matchId: number, next: ScoreDTO, phase: Phase) {
    const isKnockout = phase !== "group";
    const needsWinner = isKnockout && next.home === next.away && !next.winnerSide;
    if (timers.current[matchId]) clearTimeout(timers.current[matchId]);
    if (needsWinner) {
      setSaveStatus((s) => ({ ...s, [matchId]: "pendingWinner" }));
      return;
    }
    setSaveStatus((s) => ({ ...s, [matchId]: "saving" }));
    timers.current[matchId] = setTimeout(async () => {
      const response = await savePrediction({
        matchId,
        homeScore: next.home,
        awayScore: next.away,
        winnerSide: next.winnerSide,
      });
      setSaveStatus((s) => ({ ...s, [matchId]: response.ok ? "saved" : "error" }));
      if (response.ok) {
        setTimeout(
          () => setSaveStatus((s) => (s[matchId] === "saved" ? { ...s, [matchId]: null } : s)),
          1600,
        );
      }
    }, 650);
  }

  function setScore(matchId: number, phase: Phase, side: "home" | "away", value: number) {
    const current = predictions[matchId];
    const next: ScoreDTO = {
      home: side === "home" ? value : (current?.home ?? 0),
      away: side === "away" ? value : (current?.away ?? 0),
      winnerSide: null, // any score change resets the penalties pick
    };
    setPredictions((prev) => ({ ...prev, [matchId]: next }));
    scheduleSave(matchId, next, phase);
  }

  function setWinner(matchId: number, phase: Phase, side: "home" | "away") {
    const current = predictions[matchId];
    if (!current) return;
    const next: ScoreDTO = { ...current, winnerSide: side };
    setPredictions((prev) => ({ ...prev, [matchId]: next }));
    scheduleSave(matchId, next, phase);
  }

  const renderCard = (match: (typeof MATCHES)[number], tag: React.ReactNode) => {
    const slot = match.phase === "group" ? null : bracket.get(match.id);
    const homeCode = match.phase === "group" ? match.home! : (slot?.home ?? null);
    const awayCode = match.phase === "group" ? match.away! : (slot?.away ?? null);
    const prediction = predictions[match.id];
    const real = results[match.id];
    const open = isOpen(match.id, match.kickoffAt);
    return (
      <MatchCard
        key={match.id}
        phase={match.phase}
        kickoffAt={match.kickoffAt}
        venue={match.venue}
        tag={tag}
        homeCode={homeCode}
        awayCode={awayCode}
        score={prediction}
        open={open}
        saveStatus={saveStatus[match.id] ?? null}
        result={real}
        groupPoints={prediction && real ? groupMatchPoints(prediction, real) : null}
        detailsHref={open ? undefined : `/partido/${match.id}`}
        onScore={(side, value) => setScore(match.id, match.phase, side, value)}
        onWinner={(side) => setWinner(match.id, match.phase, side)}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* phase tabs */}
      <div className="sticky top-[57px] z-20 -mx-4 overflow-x-auto border-b border-line bg-pitch-950/95 px-4 backdrop-blur">
        <div className="flex gap-1 py-2">
          {PHASES.map((phase) => {
            const active = tab === phase.key;
            return (
              <button
                key={phase.key}
                type="button"
                onClick={() => setTab(phase.key)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition ${
                  active
                    ? "bg-volt-400 text-pitch-950"
                    : "text-ink-500 hover:bg-pitch-800 hover:text-ink-300"
                }`}
              >
                {phase.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* progress strip */}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-pitch-900 px-4 py-3">
        <div className="flex-1">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
              Pronósticos de grupos
            </p>
            <p className="font-mono text-sm font-semibold">
              <span className={groupFilled === 72 ? "text-volt-400" : "text-ink-100"}>
                {groupFilled}
              </span>
              <span className="text-ink-500">/72</span>
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-pitch-700">
            <div
              className="h-full rounded-full bg-volt-400 transition-all duration-500"
              style={{ width: `${(groupFilled / 72) * 100}%` }}
            />
          </div>
        </div>
        {bracketReady && (
          <span className="rounded-full bg-volt-400/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-volt-400">
            Bracket activo
          </span>
        )}
      </div>

      {/* today's matches */}
      {mounted && todayMatches.length > 0 && (
        <details open className="group">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink-500 hover:text-ink-300 [&::-webkit-details-marker]:hidden">
            <span className="grid h-6 w-6 place-items-center rounded-md border border-line bg-pitch-800 group-hover:border-volt-400/50">
              <span className="text-sm leading-none text-volt-400 transition-transform group-open:rotate-90">
                ▸
              </span>
            </span>
            Hoy · {todayMatches.length} partido{todayMatches.length > 1 ? "s" : ""}
            <span className="ml-1 normal-case tracking-normal text-ink-500/60 group-open:hidden">
              · toca para expandir
            </span>
          </summary>
          <div className="mt-3 space-y-3">
            {todayMatches.map((m) => renderCard(m, matchTag(m)))}
          </div>
        </details>
      )}

      {tab === "group" ? (
        <GroupsPanel
          group={group}
          onGroup={setGroup}
          predictions={predictions}
          scoreMap={scoreMap}
          renderCard={renderCard}
        />
      ) : bracketReady ? (
        <KnockoutPanel tab={tab} renderCard={renderCard} />
      ) : (
        <BracketPendingPanel
          groupFilled={groupFilled}
          predictions={predictions}
          onGoToGroup={(g) => {
            setGroup(g);
            setTab("group");
          }}
        />
      )}
    </div>
  );
}

function GroupsPanel({
  group,
  onGroup,
  predictions,
  scoreMap,
  renderCard,
}: {
  group: GroupLetter;
  onGroup: (g: GroupLetter) => void;
  predictions: ScoreRecord;
  scoreMap: Map<number, { home: number; away: number }>;
  renderCard: (match: (typeof MATCHES)[number], tag: React.ReactNode) => React.ReactNode;
}) {
  const standings = useMemo(() => computeGroupStandings(group, scoreMap), [group, scoreMap]);
  const matches = MATCHES.filter((m) => m.phase === "group" && m.group === group).sort(
    (a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt),
  );

  return (
    <div className="space-y-4">
      {/* group chips */}
      <div className="-mx-4 overflow-x-auto px-4 py-2">
        <div className="flex gap-1.5 pb-1">
          {GROUP_LETTERS.map((letter) => {
            const filled = MATCHES.filter(
              (m) => m.phase === "group" && m.group === letter && predictions[m.id] !== undefined,
            ).length;
            const active = group === letter;
            return (
              <button
                key={letter}
                type="button"
                onClick={() => onGroup(letter)}
                className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-display text-sm font-bold transition ${
                  active
                    ? "border-volt-400 bg-volt-400/15 text-volt-400"
                    : "border-line text-ink-500 hover:text-ink-300"
                }`}
              >
                {letter}
                <span
                  className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${
                    filled === 6 ? "bg-volt-400" : filled > 0 ? "bg-gold-400" : "bg-pitch-700"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* live standings */}
      <div className="overflow-hidden rounded-xl border border-line bg-pitch-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-500">
              <th className="px-3 py-2 text-left font-medium">Grupo {group} · según tu quiniela</th>
              <th className="px-2 py-2 text-center font-medium">PJ</th>
              <th className="px-2 py-2 text-center font-medium">DG</th>
              <th className="px-3 py-2 text-center font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => {
              const team = TEAM_BY_CODE.get(row.code)!;
              const qualifies = row.position <= 2;
              return (
                <tr key={row.code} className="border-b border-line/40 last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs ${
                          qualifies ? "font-bold text-volt-400" : row.position === 3 ? "text-gold-400" : "text-ink-500"
                        }`}
                      >
                        {row.position}
                      </span>
                      <span aria-hidden>{team.flag}</span>
                      <span className={qualifies ? "font-medium" : ""}>{team.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-ink-500">{row.played}</td>
                  <td className="px-2 py-2 text-center font-mono text-ink-500">
                    {row.gd > 0 ? `+${row.gd}` : row.gd}
                  </td>
                  <td className="px-3 py-2 text-center font-mono font-bold">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-line/60 px-3 py-1.5 text-[10px] text-ink-500">
          <span className="text-volt-400">1º–2º clasifican</span> · <span className="text-gold-400">3º puede clasificar entre los 8 mejores</span>
        </p>
      </div>

      <div className="space-y-3">{matches.map((m) => renderCard(m, `P${m.id}`))}</div>
    </div>
  );
}

function KnockoutPanel({
  tab,
  renderCard,
}: {
  tab: PhaseKey;
  renderCard: (match: (typeof MATCHES)[number], tag: React.ReactNode) => React.ReactNode;
}) {
  const matches = MATCHES.filter((m) =>
    tab === "finals" ? m.phase === "third" || m.phase === "final" : m.phase === tab,
  ).sort((a, b) => a.id - b.id);

  return (
    <div className="space-y-3">
      {matches.map((m) => renderCard(m, matchTag(m)))}
      <p className="px-1 text-center text-[11px] text-ink-500">
        Los cruces salen de tus pronósticos de grupos. Si cambias un grupo (aún abierto), los
        equipos se actualizan pero tus marcadores de llaves se conservan.
      </p>
    </div>
  );
}

function BracketPendingPanel({
  groupFilled,
  predictions,
  onGoToGroup,
}: {
  groupFilled: number;
  predictions: ScoreRecord;
  onGoToGroup: (g: GroupLetter) => void;
}) {
  const missingByGroup = GROUP_LETTERS.map((letter) => ({
    letter,
    missing: MATCHES.filter(
      (m) => m.phase === "group" && m.group === letter && predictions[m.id] === undefined,
    ).length,
  })).filter((g) => g.missing > 0);

  return (
    <div className="rounded-xl border border-dashed border-line-bright bg-pitch-900/60 px-5 py-8 text-center">
      <p className="font-display text-4xl font-extrabold text-ink-500">
        {groupFilled}
        <span className="text-ink-500/50">/72</span>
      </p>
      <h3 className="mt-2 font-display text-lg font-bold">Tu bracket aún no se arma</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
        Completa los 72 pronósticos de la fase de grupos y los cruces de eliminación directa se
        formarán solos con tus clasificados.
      </p>
      <div className="mx-auto mt-4 flex max-w-xs flex-wrap justify-center gap-1.5">
        {missingByGroup.map(({ letter, missing }) => (
          <button
            key={letter}
            type="button"
            onClick={() => onGoToGroup(letter)}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-300 transition hover:border-gold-400/60 hover:text-gold-400"
          >
            {letter} <span className="font-mono text-ink-500">falta{missing > 1 ? "n" : ""} {missing}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
