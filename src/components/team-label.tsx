"use client";

import { TEAM_BY_CODE } from "@/lib/dto";
import { Tooltip } from "./tooltip";

export function TeamLabel({
  code,
  placeholder = "Por definir",
  align = "left",
}: {
  code: string | null;
  placeholder?: string;
  align?: "left" | "right";
}) {
  const team = code ? TEAM_BY_CODE.get(code) : null;
  const alignClass = align === "right" ? "flex-row-reverse text-right" : "text-left";
  if (!team) {
    return (
      <span className={`flex min-w-0 items-center gap-2 ${alignClass} text-ink-500/70`}>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-line-bright text-[10px]">
          ?
        </span>
        <span className="truncate text-sm italic">{placeholder}</span>
      </span>
    );
  }
  return (
    <Tooltip content={team.name}>
      <span className={`flex min-w-0 overflow-hidden items-center gap-2 ${alignClass}`}>
        <span aria-hidden className="shrink-0 text-xl leading-none">
          {team.flag}
        </span>
        <span className="truncate text-sm font-medium">{team.name}</span>
      </span>
    </Tooltip>
  );
}
