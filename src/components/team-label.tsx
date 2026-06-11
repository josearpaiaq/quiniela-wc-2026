import { TEAM_BY_CODE } from "@/lib/dto";

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
      <span className={`flex items-center gap-2 ${alignClass} text-ink-500/70`}>
        <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-line-bright text-[10px]">
          ?
        </span>
        <span className="text-sm italic">{placeholder}</span>
      </span>
    );
  }
  return (
    <span className={`flex items-center gap-2 ${alignClass}`}>
      <span aria-hidden className="text-xl leading-none">
        {team.flag}
      </span>
      <span className="text-sm font-medium">{team.name}</span>
    </span>
  );
}
