"use client";

import { Medal, Trophy } from "lucide-react";
import { MATCHES } from "@/lib/db/seed-data";
import { TEAM_BY_CODE, type ScoreRecord } from "@/lib/dto";

const SOURCE_MAP = new Map(
  MATCHES.filter((m) => m.homeSource).map((m) => [
    m.id,
    { homeSource: m.homeSource!, awaySource: m.awaySource! },
  ]),
);

function formatSource(source: string): string {
  if (/^[A-L][12]$/.test(source)) return `${source[1]}° Grupo ${source[0]}`;
  if (source.startsWith("3")) return `3° (${source.slice(1).split("").join("/")})`;
  if (source.startsWith("W")) return `G P${source.slice(1)}`;
  if (source.startsWith("L")) return `P P${source.slice(1)}`;
  return source;
}

type SlotRecord = Record<number, { home: string | null; away: string | null }>;

// Visual order derived from the tree so children sit next to their parent.
function childIds(matchId: number): [number, number] | null {
  const match = MATCHES.find((m) => m.id === matchId)!;
  const refs = [match.homeSource, match.awaySource].map((s) =>
    s && /^W\d+$/.test(s) ? Number(s.slice(1)) : null,
  );
  return refs[0] && refs[1] ? [refs[0], refs[1]] : null;
}

function displayOrder(round: number[]): number[] {
  // round given in display order; returns children in display order
  return round.flatMap((id) => childIds(id) ?? []);
}

const SF_ORDER = [101, 102];
const QF_ORDER = displayOrder(SF_ORDER);
const R16_ORDER = displayOrder(QF_ORDER);
const R32_ORDER = displayOrder(R16_ORDER);

const COLUMNS: Array<{ title: string; ids: number[]; span: number }> = [
  { title: "Dieciseisavos", ids: R32_ORDER, span: 1 },
  { title: "Octavos", ids: R16_ORDER, span: 2 },
  { title: "Cuartos", ids: QF_ORDER, span: 4 },
  { title: "Semifinales", ids: SF_ORDER, span: 8 },
  { title: "Final", ids: [104], span: 16 },
];

function winnerSideOf(score: ScoreRecord[number] | undefined): "home" | "away" | null {
  if (!score) return null;
  if (score.home > score.away) return "home";
  if (score.home < score.away) return "away";
  return score.winnerSide ?? null;
}

function TeamRow({
  code,
  goals,
  result,
  source,
}: {
  code: string | null;
  goals: number | null;
  result: "win" | "loss" | null;
  source?: string | null;
}) {
  const team = code ? TEAM_BY_CODE.get(code) : null;
  const placeholder = !team && source ? formatSource(source) : null;
  return (
    <div
      className={`flex items-center justify-between gap-1 px-2 py-1 ${
        result === "win" ? "text-volt-400" : result === "loss" ? "text-ink-500/70" : "text-ink-300"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden className="text-sm leading-none">
          {team?.flag ?? "·"}
        </span>
        <span className="truncate text-xs font-medium">
          {team?.name ?? (
            <span className="italic text-ink-500/60">{placeholder ?? "Por definir"}</span>
          )}
        </span>
      </span>
      <span className="font-mono text-xs font-semibold">
        {goals ?? ""}
        {result === "win" && goals !== null && <span className="ml-0.5 text-[9px]">▸</span>}
      </span>
    </div>
  );
}

function MatchNode({
  matchId,
  slots,
  scores,
}: {
  matchId: number;
  slots: SlotRecord;
  scores: ScoreRecord;
}) {
  const slot = slots[matchId];
  const score = scores[matchId];
  const winner = winnerSideOf(score);
  const isFinal = matchId === 104;
  const sources = SOURCE_MAP.get(matchId);
  return (
    <div
      className={`w-44 divide-y divide-line/60 rounded-lg border bg-pitch-900 ${
        isFinal ? "border-gold-400/50 shadow-[0_0_30px_rgba(255,198,63,0.12)]" : "border-line"
      }`}
    >
      <div className="flex items-center justify-end px-2 pt-1">
        <span className="font-mono text-[9px] text-ink-600">P{matchId}</span>
      </div>
      <TeamRow
        code={slot?.home ?? null}
        goals={score?.home ?? null}
        result={winner ? (winner === "home" ? "win" : "loss") : null}
        source={sources?.homeSource}
      />
      <TeamRow
        code={slot?.away ?? null}
        goals={score?.away ?? null}
        result={winner ? (winner === "away" ? "win" : "loss") : null}
        source={sources?.awaySource}
      />
    </div>
  );
}

export function BracketView({
  slots,
  scores,
}: {
  slots: SlotRecord;
  scores: ScoreRecord;
}) {
  const final = slots[104];
  const finalWinner = winnerSideOf(scores[104]);
  const championCode = finalWinner && final ? (finalWinner === "home" ? final.home : final.away) : null;
  const champion = championCode ? TEAM_BY_CODE.get(championCode) : null;
  const third = slots[103];
  const thirdWinner = winnerSideOf(scores[103]);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-bold uppercase">El cuadro</h2>

      {/* champion banner */}
      <div className="flex items-center justify-center gap-3 rounded-xl border border-gold-400/40 bg-gradient-to-r from-pitch-900 via-pitch-800 to-pitch-900 px-4 py-3">
        <Trophy aria-hidden className="h-7 w-7 text-gold-400" />
        {champion ? (
          <p className="font-display text-lg font-extrabold uppercase">
            <span aria-hidden className="mr-2">{champion.flag}</span>
            {champion.name}
            <span className="ml-2 text-xs font-bold uppercase tracking-widest text-gold-400">
              Campeón
            </span>
          </p>
        ) : (
          <p className="text-sm italic text-ink-500">Campeón por definir</p>
        )}
      </div>

      {/* tree */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-3">
          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col">
              <p className="sticky left-0 mb-2 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">
                {column.title}
              </p>
              <div
                className="grid flex-1 gap-y-2"
                style={{ gridTemplateRows: "repeat(16, minmax(3.4rem, 1fr))" }}
              >
                {column.ids.map((id) => (
                  <div
                    key={id}
                    className="flex items-center"
                    style={{ gridRow: `span ${column.span} / span ${column.span}` }}
                  >
                    <MatchNode matchId={id} slots={slots} scores={scores} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* third place */}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-pitch-900 px-4 py-3">
        <Medal aria-hidden className="h-5 w-5 shrink-0 text-[#cd7f32]" />
        <div className="text-sm">
          <p className="text-[10px] uppercase tracking-wider text-ink-500">Tercer puesto</p>
          {third?.home && third.away ? (
            <p>
              {TEAM_BY_CODE.get(third.home)?.flag} {TEAM_BY_CODE.get(third.home)?.name}
              <span className="mx-2 font-mono text-ink-500">
                {scores[103] ? `${scores[103].home}–${scores[103].away}` : "vs"}
              </span>
              {TEAM_BY_CODE.get(third.away)?.flag} {TEAM_BY_CODE.get(third.away)?.name}
              {thirdWinner && (
                <span className="ml-2 text-xs text-gold-400">
                  gana {TEAM_BY_CODE.get(thirdWinner === "home" ? third.home : third.away)?.name}
                </span>
              )}
            </p>
          ) : (
            <p className="italic text-ink-500">
              {(() => {
                const s = SOURCE_MAP.get(103);
                if (!s) return "Por definir";
                const home = third?.home
                  ? (TEAM_BY_CODE.get(third.home)?.name ?? formatSource(s.homeSource))
                  : formatSource(s.homeSource);
                const away = third?.away
                  ? (TEAM_BY_CODE.get(third.away)?.name ?? formatSource(s.awaySource))
                  : formatSource(s.awaySource);
                return `${home} vs ${away}`;
              })()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
