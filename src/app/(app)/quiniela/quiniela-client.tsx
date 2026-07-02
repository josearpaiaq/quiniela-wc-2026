"use client";

import { Fragment, forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs";
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
  buildTeamHistories,
  computeGroupStandings,
  groupMatchPoints,
  knockoutMatchPoints,
  rankThirds,
  type ThirdRow,
} from "@/lib/tournament";
const VALID_TABS = ["group", "r32", "r16", "qf", "sf", "finals"] as const;

function getActivePhase(now: Date): (typeof VALID_TABS)[number] {
  let active: (typeof VALID_TABS)[number] = "group";
  for (const tab of VALID_TABS) {
    const firstKickoff = Math.min(
      ...MATCHES.filter((m) =>
        tab === "finals" ? m.phase === "final" || m.phase === "third" : m.phase === tab,
      ).map((m) => Date.parse(m.kickoffAt)),
    );
    if (Number.isFinite(firstKickoff) && firstKickoff <= now.getTime()) {
      active = tab;
    }
  }
  return active;
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

import { isSameLocalDay } from "@/lib/format";
import { savePrediction } from "@/lib/actions/predictions";
import { MatchCard, type SaveStatus } from "@/components/match-card";
import { useConfetti } from "@/components/confetti";
import { TeamHistoryProvider } from "@/components/team-history";

type PhaseKey = Phase | "finals";

const GROUP_MATCH_IDS = MATCHES.filter((m) => m.phase === "group").map((m) => m.id);

const PAN_MATCH_DAYS = new Set(
  MATCHES
    .filter((m) => m.phase === "group" && (m.home === "PAN" || m.away === "PAN"))
    .map((m) => localDateKey(new Date(m.kickoffAt))),
);

const CONFETTI_SEEN_KEY = "quiniela-confetti-seen";

function hasSeenConfettiToday(dateKey: string): boolean {
  try {
    return localStorage.getItem(CONFETTI_SEEN_KEY) === dateKey;
  } catch {
    return false;
  }
}

function markConfettiSeen(dateKey: string): void {
  try {
    localStorage.setItem(CONFETTI_SEEN_KEY, dateKey);
  } catch {}
}


function PanamaAutoTrigger() {
  const { trigger } = useConfetti();
  useEffect(() => {
    const dateKey = localDateKey(new Date());
    if (PAN_MATCH_DAYS.has(dateKey) && !hasSeenConfettiToday(dateKey)) {
      trigger("🇵🇦");
      markConfettiSeen(dateKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}


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
  bracketOverrides,
}: {
  initialPredictions: ScoreRecord;
  results: ScoreRecord;
  openOverrides: number[];
  bracketOverrides: { matchId: number; home: string | null; away: string | null }[];
}) {
  const [predictions, setPredictions] = useState<ScoreRecord>(initialPredictions);
  const [{ tab, group }, setNav] = useQueryStates(
    {
      tab: parseAsStringLiteral(VALID_TABS).withDefault(getActivePhase(new Date())),
      group: parseAsStringLiteral(GROUP_LETTERS).withDefault("A"),
    },
    { shallow: true },
  );
  const setTab = (t: PhaseKey) => setNav({ tab: t as (typeof VALID_TABS)[number] });
  const setGroup = (g: GroupLetter) => setNav({ group: g });
  const [saveStatus, setSaveStatus] = useState<Record<number, SaveStatus>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const overrides = useMemo(() => new Set(openOverrides), [openOverrides]);
  const groupsPanelRef = useRef<HTMLDivElement>(null);
  const pendingScrollToGroups = useRef(false);

  useEffect(() => {
    if (pendingScrollToGroups.current && groupsPanelRef.current) {
      groupsPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      pendingScrollToGroups.current = false;
    }
  }, [tab]);

  const scoreMap = useMemo(() => toScoreMap(predictions), [predictions]);
  const realScoreMap = useMemo(() => toScoreMap(results), [results]);
  const overridesMap = useMemo(
    () => new Map(bracketOverrides.map((o) => [o.matchId, { home: o.home, away: o.away }])),
    [bracketOverrides],
  );
  const realBracket = useMemo(() => buildBracket(realScoreMap, overridesMap), [realScoreMap, overridesMap]);
  const bracketReady = useMemo(() => allGroupsComplete(scoreMap), [scoreMap]);
  const teamHistories = useMemo(
    () => buildTeamHistories(scoreMap, realScoreMap, overridesMap),
    [scoreMap, realScoreMap, overridesMap],
  );

  const groupFilled = useMemo(
    () => GROUP_MATCH_IDS.filter((id) => predictions[id] !== undefined).length,
    [predictions],
  );

  // captured once per mount: lock display is advisory, the server re-validates
  const [now] = useState(() => Date.now());

  // track tab in a ref so renderCard's useCallback doesn't depend on it
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // client-only: "today" depends on the viewer's timezone, so skip it on the
  // server render to avoid a hydration mismatch around midnight / other TZs
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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

  const renderCard = useCallback((match: (typeof MATCHES)[number], tag: React.ReactNode) => {
    const slot = match.phase === "group" ? null : realBracket.get(match.id);
    const homeCode = match.phase === "group" ? match.home! : (slot?.home ?? null);
    const awayCode = match.phase === "group" ? match.away! : (slot?.away ?? null);
    const prediction = predictions[match.id];
    const real = results[match.id];
    const teamsReady = match.phase === "group" || (slot?.home != null && slot?.away != null);
    const open = overrides.has(match.id) || (now < Date.parse(match.kickoffAt) && teamsReady);
    return (
      <MatchCard
        key={match.id}
        phase={match.phase}
        kickoffAt={match.kickoffAt}
        venue={match.venue}
        tag={tag}
        group={match.phase === "group" ? match.group : undefined}
        onGroupClick={
          match.phase === "group" && match.group
            ? () => {
              setNav({ tab: "group", group: match.group as GroupLetter });
              if (tabRef.current === "group") {
                requestAnimationFrame(() => {
                  groupsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              } else {
                pendingScrollToGroups.current = true;
              }
            } : undefined}
        homeCode={homeCode}
        awayCode={awayCode}
        score={prediction}
        open={open}
        saveStatus={saveStatus[match.id] ?? null}
        result={real}
        matchPoints={
          prediction && real
            ? match.phase === "group"
              ? groupMatchPoints(prediction, real)
              : match.phase === "third"
                ? null
                : knockoutMatchPoints(match.phase, prediction, real)
            : null
        }
        detailsHref={open ? undefined : `/partido/${match.id}`}
        onScore={(side, value) => setScore(match.id, match.phase, side, value)}
        onWinner={(side) => setWinner(match.id, match.phase, side)}
      />
    );
  }, [realBracket, predictions, results, overrides, now, saveStatus, setNav]);

  return (
    <TeamHistoryProvider histories={teamHistories}>
      <PanamaAutoTrigger />
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

      {/* upcoming matches by day */}
      {mounted && <DayMatchesPanel now={now} renderCard={renderCard} />}

      {tab === "group" ? (
        <>
          <ThirdPlaceRankingPanel
            scoreMap={scoreMap}
            realScoreMap={realScoreMap}
          />
          <GroupsPanel
            group={group}
            onGroup={setGroup}
            predictions={predictions}
            scoreMap={scoreMap}
            realScoreMap={realScoreMap}
            renderCard={renderCard}
            ref={groupsPanelRef}
          />
        </>
      ) : (
        <>
          <SectionSeparator label={PHASES.find((p) => p.key === tab)?.label ?? "Eliminación directa"} />
          <KnockoutPanel tab={tab} renderCard={renderCard} />
        </>
      )}
    </div>
    </TeamHistoryProvider>
  );
}

const GroupsPanel = forwardRef<HTMLDivElement, {
  group: GroupLetter;
  onGroup: (g: GroupLetter) => void;
  predictions: ScoreRecord;
  scoreMap: Map<number, { home: number; away: number }>;
  realScoreMap: Map<number, { home: number; away: number }>;
  renderCard: (match: (typeof MATCHES)[number], tag: React.ReactNode) => React.ReactNode;
}>(function GroupsPanel({
  group,
  onGroup,
  predictions,
  scoreMap,
  realScoreMap,
  renderCard,
}, ref) {
  const [view, setView] = useQueryState(
    "gv",
    parseAsStringLiteral(["mine", "real"] as const).withDefault("mine"),
  );
  const activeMap = view === "mine" ? scoreMap : realScoreMap;
  const standings = useMemo(() => computeGroupStandings(group, activeMap), [group, activeMap]);
  const matches = useMemo(
    () => MATCHES.filter((m) => m.phase === "group" && m.group === group).sort(
      (a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt),
    ),
    [group],
  );
  const filledByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    for (const letter of GROUP_LETTERS) {
      map[letter] = MATCHES.filter(
        (m) => m.phase === "group" && m.group === letter && predictions[m.id] !== undefined,
      ).length;
    }
    return map;
  }, [predictions]);
  const hasRealResults = matches.some((m) => realScoreMap.has(m.id));

  return (
    <div ref={ref} className="scroll-mt-28 space-y-4">
      {/* group chips */}
      <div className="-mx-4 overflow-x-auto px-4 py-2">
        <div className="flex gap-1.5 pb-1">
          {GROUP_LETTERS.map((letter) => {
            const filled = filledByGroup[letter] ?? 0;
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

      {/* standings source toggle */}
      <div className="flex justify-end">
        <div className="flex rounded-lg border border-line p-0.5">
          {(
            [
              { key: "mine", label: "Tu quiniela" },
              { key: "real", label: "Real" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                view === key ? "bg-volt-400 text-pitch-950" : "text-ink-500 hover:text-ink-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* live standings */}
      <div className="overflow-hidden rounded-xl border border-line bg-pitch-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-500">
              <th className="px-3 py-2 text-left font-medium">
                Grupo {group} · {view === "mine" ? "según tu quiniela" : "resultados reales"}
              </th>
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
          {view === "real" && !hasRealResults ? (
            <span className="italic">Aún no hay resultados reales en este grupo</span>
          ) : (
            <>
              <span className="text-volt-400">1º–2º clasifican</span> · <span className="text-gold-400">3º puede clasificar entre los 8 mejores</span>
            </>
          )}
        </p>
      </div>

      <div className="space-y-3">{matches.map((m) => renderCard(m, `P${m.id}`))}</div>
    </div>
  );
});

function KnockoutPanel({
  tab,
  renderCard,
}: {
  tab: PhaseKey;
  renderCard: (match: (typeof MATCHES)[number], tag: React.ReactNode) => React.ReactNode;
}) {
  const matches = useMemo(
    () => MATCHES.filter((m) =>
      tab === "finals" ? m.phase === "third" || m.phase === "final" : m.phase === tab,
    ).sort((a, b) => a.id - b.id),
    [tab],
  );

  return (
    <div className="space-y-3">
      <p className="px-1 text-center text-[11px] text-ink-500">
        Los cruces se arman con los resultados reales. Puedes pronosticar un partido cuando ambos
        equipos estén confirmados y antes del pitazo inicial.
      </p>
      {matches.map((m) => renderCard(m, matchTag(m)))}
    </div>
  );
}

const DayMatchesPanel = memo(function DayMatchesPanel({
  now,
  renderCard,
}: {
  now: number;
  renderCard: (match: (typeof MATCHES)[number], tag: React.ReactNode) => React.ReactNode;
}) {
  const today = new Date(now);
  const todayKey = localDateKey(today);

  const allDays = useMemo(() => {
    const dayMap = new Map<string, (typeof MATCHES)[number][]>();
    for (const m of MATCHES) {
      const key = localDateKey(new Date(m.kickoffAt));
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push(m);
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);

    return [...dayMap.keys()].sort().map((key) => {
      const [y, mo, d] = key.split("-").map(Number);
      const date = new Date(y, mo - 1, d);

      let label: string;
      if (isSameLocalDay(date, today)) label = "Hoy";
      else if (isSameLocalDay(date, tomorrow)) label = "Mañana";
      else if (isSameLocalDay(date, dayAfter)) {
        const name = new Intl.DateTimeFormat("es", { weekday: "long" }).format(date);
        label = name.charAt(0).toUpperCase() + name.slice(1);
      } else {
        label = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(date);
      }

      const matches = dayMap.get(key)!.sort(
        (a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt),
      );
      return { key, label, matches, isPast: key < todayKey };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const [dayParam, setDayParam] = useQueryState("day", parseAsString);
  const activeKey = (() => {
    if (dayParam && allDays.some((d) => d.key === dayParam)) return dayParam;
    return allDays.find((d) => d.key >= todayKey)?.key ?? allDays[0]?.key ?? todayKey;
  })();
  const userChangedDay = useRef(false);
  const setActiveKey = (key: string) => {
    userChangedDay.current = true;
    setDayParam(key === todayKey ? null : key);
  };

  const [collapsed, setCollapsed] = useState(false);
  const activeDay = allDays.find((d) => d.key === activeKey);
  const activeIndex = allDays.findIndex((d) => d.key === activeKey);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!collapsed) {
      activeButtonRef.current?.scrollIntoView({
        behavior: userChangedDay.current ? "smooth" : "instant",
        block: "nearest",
        inline: "center",
      });
    }
    userChangedDay.current = false;
  }, [activeKey, collapsed]);

  if (allDays.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-pitch-900">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-ink-400">
          Partidos del mundial
        </span>
        <span className="flex items-center gap-2">
          {collapsed && activeDay && (
            <span className="font-mono text-xs text-ink-600">{activeDay.label}</span>
          )}
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 text-ink-500 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          />
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-3 border-t border-line/60 px-4 pb-4 pt-3">
          {/* day strip */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => allDays[activeIndex - 1] && setActiveKey(allDays[activeIndex - 1].key)}
              className="shrink-0 rounded-md p-1 text-ink-500 transition hover:text-ink-300 disabled:opacity-20"
              aria-label="Día anterior"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>

            <div ref={scrollRef} className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {allDays.map(({ key, label, matches }) => {
                const active = key === activeKey;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    ref={active ? activeButtonRef : undefined}
                    type="button"
                    onClick={() => setActiveKey(key)}
                    className={`relative shrink-0 w-[calc((100%-0.5rem)/3)] md:w-auto rounded-lg px-2.5 py-1.5 md:px-4 md:py-2 text-center transition ${
                      active
                        ? "bg-volt-400 text-pitch-950"
                        : "border border-line text-ink-500 hover:border-line-bright hover:text-ink-300"
                    }`}
                  >
                    <span className="block font-display text-[11px] font-bold uppercase leading-none">
                      {label}
                    </span>
                    <span className={`block font-mono text-[10px] leading-tight ${active ? "text-pitch-950/60" : "text-ink-600"}`}>
                      {matches.length}p
                    </span>
                    {isToday && !active && (
                      <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-volt-400" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={activeIndex >= allDays.length - 1}
              onClick={() => allDays[activeIndex + 1] && setActiveKey(allDays[activeIndex + 1].key)}
              className="shrink-0 rounded-md p-1 text-ink-500 transition hover:text-ink-300 disabled:opacity-20"
              aria-label="Día siguiente"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>

          {activeDay && (
            <div className="space-y-3">
              {activeDay.matches.map((m) => renderCard(m, matchTag(m)))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function provisionalThirds(
  scoreMap: Map<number, { home: number; away: number }>,
): (ThirdRow & { incomplete: boolean })[] {
  const rows = GROUP_LETTERS.map((g) => {
    const standings = computeGroupStandings(g, scoreMap);
    const third = standings[2];
    const groupMatches = MATCHES.filter((m) => m.phase === "group" && m.group === g);
    const incomplete = !groupMatches.every((m) => scoreMap.has(m.id));
    return { ...third, rank: 0, qualified: false, incomplete };
  });
  rows.sort(
    (a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.group.localeCompare(b.group),
  );
  return rows.map((r, i) => ({ ...r, rank: i + 1, qualified: i < 8 }));
}

function ThirdPlaceRankingPanel({
  scoreMap,
  realScoreMap,
}: {
  scoreMap: Map<number, { home: number; away: number }>;
  realScoreMap: Map<number, { home: number; away: number }>;
}) {
  const [view] = useQueryState(
    "gv",
    parseAsStringLiteral(["mine", "real"] as const).withDefault("mine"),
  );
  const [collapsed, setCollapsed] = useState(true);
  const activeMap = view === "mine" ? scoreMap : realScoreMap;

  const isComplete = allGroupsComplete(activeMap);
  const thirds: (ThirdRow & { incomplete?: boolean })[] = useMemo(() => {
    if (isComplete) {
      const result = rankThirds(activeMap);
      return result ? result.map((r) => ({ ...r, incomplete: false })) : [];
    }
    return provisionalThirds(activeMap);
  }, [activeMap, isComplete]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-pitch-900">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-400">
          Mejores terceros
          {!isComplete && (
            <span className="rounded bg-gold-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-400">
              Provisional
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 text-ink-500 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>

      {!collapsed && (
        <div className="border-t border-line/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-500">
                <th className="px-3 py-2 text-left font-medium">
                  {view === "mine" ? "Según tu quiniela" : "Resultados reales"}
                </th>
                <th className="px-2 py-2 text-center font-medium">Gr</th>
                <th className="px-2 py-2 text-center font-medium">DG</th>
                <th className="px-2 py-2 text-center font-medium">GF</th>
                <th className="px-3 py-2 text-center font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {thirds.map((row, index) => {
                const team = TEAM_BY_CODE.get(row.code)!;
                const isNinth = index === 8;
                return (
                  <Fragment key={row.code}>
                    {isNinth && (
                      <tr className="border-t-2 border-dashed border-line-bright">
                        <td colSpan={5} className="px-3 py-1 text-[10px] text-ink-500 italic">
                          ↑ Clasifican los 8 mejores terceros
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-line/40 last:border-0">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-4 text-right font-mono text-xs ${
                              row.qualified ? "font-bold text-volt-400" : "text-ink-500"
                            }`}
                          >
                            {row.rank}
                          </span>
                          <span aria-hidden>{team.flag}</span>
                          <span className={row.qualified ? "font-medium" : "text-ink-400"}>
                            {team.name}
                          </span>
                          {"incomplete" in row && row.incomplete && (
                            <span className="font-mono text-[10px] text-ink-600">···</span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-[11px] text-ink-500">
                        {row.group}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-ink-500">
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-ink-500">{row.gf}</td>
                      <td className="px-3 py-2 text-center font-mono font-bold">{row.points}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!isComplete && (
            <p className="border-t border-line/60 px-3 py-1.5 text-[10px] italic text-ink-500">
              Clasificación provisional · ··· indica grupos con partidos pendientes
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SectionSeparator({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-line" />
      <span className="shrink-0 font-display text-[11px] font-bold uppercase tracking-widest text-ink-500">
        {label}
      </span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

