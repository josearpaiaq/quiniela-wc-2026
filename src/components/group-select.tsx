"use client";

import { useRouter } from "next/navigation";
import type { UserGroup } from "@/lib/groups";

/** Select to switch the selected group; hidden when there is nothing to switch. */
export function GroupSelect({
  groups,
  selectedId,
  basePath,
}: {
  groups: UserGroup[];
  selectedId: string;
  basePath: string;
}) {
  const router = useRouter();

  if (groups.length < 2) return null;

  return (
    <select
      aria-label="Grupo"
      value={selectedId}
      onChange={(e) => router.push(`${basePath}?grupo=${e.target.value}`)}
      className="appearance-none self-start rounded-lg border border-line bg-pitch-900 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-ink-100 outline-none focus:border-volt-400"
    >
      {groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>
  );
}
