import {
  GROUP_EXACT_POINTS,
  GROUP_OUTCOME_POINTS,
} from "@/lib/tournament/scoring";
import { ROUND_VALUES } from "@/lib/tournament/types";

const KNOCKOUT_ROUNDS = [
  { key: "r32" as const, label: "Ronda de 32", slots: 32 },
  { key: "r16" as const, label: "Octavos de final", slots: 16 },
  { key: "qf" as const, label: "Cuartos de final", slots: 8 },
  { key: "sf" as const, label: "Semifinales", slots: 4 },
  { key: "final" as const, label: "Final", slots: 2 },
];

export default function ReglasPage() {
  return (
    <div className="mx-auto max-w-xl space-y-8 pb-8">
      <header>
        <h2 className="font-display text-xl font-bold uppercase">Reglas de puntaje</h2>
        <p className="mt-1 text-sm text-ink-500">
          Así se calculan los puntos de la quiniela.
        </p>
      </header>

      {/* Group stage */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500">
          Fase de grupos · 72 partidos
        </h3>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          <ScoreRow
            label="Marcador exacto"
            description="Acertaste el resultado exacto del partido"
            example="Pronosticaste 2-1, terminó 2-1"
            points={GROUP_EXACT_POINTS}
          />
          <ScoreRow
            label="Resultado correcto"
            description="Acertaste quién gana o si empata, pero no el marcador exacto"
            example="Pronosticaste 2-1, terminó 3-0"
            points={GROUP_OUTCOME_POINTS}
          />
          <ScoreRow
            label="Resultado incorrecto"
            description="Ni el ganador ni el marcador coinciden"
            example="Pronosticaste 2-1, terminó 0-1"
            points={0}
          />
        </div>
        <p className="px-1 text-[11px] text-ink-500">
          Nota: en grupos puede haber empates, así que predecir 1-1 cuando termina 1-1 da 3 pts;
          predecir 0-0 cuando termina 1-1 da 1 pt.
        </p>
      </section>

      {/* Knockout rounds */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500">
          Eliminación directa · rondas
        </h3>
        <p className="text-sm text-ink-400">
          Para los partidos de eliminación no se puntúa el marcador. En cambio, ganas puntos
          por cada <strong className="text-ink-200">equipo</strong> que predijiste que avanzaría
          a esa ronda — sin importar en qué posición del bracket quedó.
        </p>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {KNOCKOUT_ROUNDS.map((round) => (
            <div key={round.key} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{round.label}</p>
                <p className="text-[11px] text-ink-500">
                  {round.slots} equipos · {ROUND_VALUES[round.key]} pt
                  {ROUND_VALUES[round.key] > 1 ? "s" : ""} por equipo acertado
                </p>
              </div>
              <PointsBadge points={ROUND_VALUES[round.key]} suffix="/ equipo" />
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Campeón</p>
              <p className="text-[11px] text-ink-500">
                Bonus adicional si acertaste al campeón del torneo
              </p>
            </div>
            <PointsBadge points={ROUND_VALUES.champion} suffix="bonus" highlight />
          </div>
        </div>
        <p className="px-1 text-[11px] text-ink-500">
          Ejemplo: si predijiste que Brasil llega a semifinales y efectivamente lo hace, sumas{" "}
          {ROUND_VALUES.r32} + {ROUND_VALUES.r16} + {ROUND_VALUES.qf} + {ROUND_VALUES.sf} ={" "}
          {ROUND_VALUES.r32 + ROUND_VALUES.r16 + ROUND_VALUES.qf + ROUND_VALUES.sf} pts por ese equipo.
        </p>
      </section>

      {/* Max points */}
      <section className="rounded-xl border border-volt-400/30 bg-volt-400/5 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-volt-400">
          Máximo teórico
        </p>
        <p className="mt-2 font-mono text-3xl font-bold">
          {72 * GROUP_EXACT_POINTS +
            32 * ROUND_VALUES.r32 +
            16 * ROUND_VALUES.r16 +
            8 * ROUND_VALUES.qf +
            4 * ROUND_VALUES.sf +
            2 * ROUND_VALUES.final +
            ROUND_VALUES.champion}{" "}
          <span className="text-sm font-normal text-ink-400">puntos</span>
        </p>
        <p className="mt-1 text-[11px] text-ink-500">
          Si acertaras el marcador exacto de los 72 partidos de grupos y todos los avances de
          eliminación.
        </p>
      </section>
    </div>
  );
}

function ScoreRow({
  label,
  description,
  example,
  points,
}: {
  label: string;
  description: string;
  example: string;
  points: number;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-ink-500">{description}</p>
        <p className="mt-0.5 font-mono text-[11px] text-ink-600">{example}</p>
      </div>
      <PointsBadge points={points} />
    </div>
  );
}

function PointsBadge({
  points,
  suffix,
  highlight,
}: {
  points: number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-right">
      <span
        className={`font-mono text-xl font-bold ${
          points === 0
            ? "text-ink-700"
            : highlight
              ? "text-volt-400"
              : "text-volt-400"
        }`}
      >
        {points}
      </span>
      <span className="ml-1 text-[10px] text-ink-500">pt{points !== 1 ? "s" : ""}</span>
      {suffix && <p className="text-[10px] text-ink-600">{suffix}</p>}
    </div>
  );
}
