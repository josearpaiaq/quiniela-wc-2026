import { TEAM_BY_CODE } from "@/lib/dto";
import type { Side } from "@/lib/tournament";

/** Badge indicating which team advanced on penalties, e.g. "pen 🇧🇷". */
export function PenaltyBadge({
  winnerSide,
  homeCode,
  awayCode,
}: {
  winnerSide: Side | null | undefined;
  homeCode: string | null;
  awayCode: string | null;
}) {
  if (!winnerSide) return null;
  const code = winnerSide === "home" ? homeCode : awayCode;
  const flag = code ? TEAM_BY_CODE.get(code)?.flag : null;
  return (
    <span className="shrink-0 whitespace-nowrap text-[11px] text-gold-400" title="Avanzó en penales">
      pen {flag ?? (winnerSide === "home" ? "local" : "visita")}
    </span>
  );
}
