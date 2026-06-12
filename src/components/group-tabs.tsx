import Link from "next/link";
import type { UserGroup } from "@/lib/groups";

/** Pill nav to switch the selected group; hidden when there is nothing to switch. */
export function GroupTabs({
  groups,
  selectedId,
  hrefFor,
}: {
  groups: UserGroup[];
  selectedId: string;
  hrefFor: (groupId: string) => string;
}) {
  if (groups.length < 2) return null;
  return (
    <nav className="flex flex-wrap gap-1 self-start rounded-lg border border-line p-0.5">
      {groups.map((group) => (
        <Link
          key={group.id}
          href={hrefFor(group.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
            group.id === selectedId
              ? "bg-volt-400 text-pitch-950"
              : "text-ink-500 hover:text-ink-300"
          }`}
        >
          {group.name}
        </Link>
      ))}
    </nav>
  );
}
