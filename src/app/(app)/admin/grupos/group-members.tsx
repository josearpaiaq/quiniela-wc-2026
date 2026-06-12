"use client";

import { useState, useTransition } from "react";
import { addGroupMember, removeGroupMember } from "@/lib/actions/groups";

export interface MemberOption {
  id: string;
  name: string;
}

export function GroupMembers({
  groupId,
  members,
  nonMembers,
}: {
  groupId: string;
  members: MemberOption[];
  nonMembers: MemberOption[];
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addGroupMember({ groupId, userId: selected });
      setError(result.ok ? null : result.error);
      if (result.ok) setSelected("");
    });
  }

  function remove(member: MemberOption) {
    if (!window.confirm(`¿Quitar a ${member.name} del grupo?`)) return;
    startTransition(async () => {
      const result = await removeGroupMember({ groupId, userId: member.id });
      setError(result.ok ? null : result.error);
    });
  }

  return (
    <div className="space-y-2">
      {members.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-1.5 rounded-full border border-line bg-pitch-800 py-1 pl-3 pr-1.5 text-xs text-ink-300"
            >
              {member.name}
              <button
                type="button"
                onClick={() => remove(member)}
                disabled={pending}
                aria-label={`Quitar a ${member.name}`}
                className="cursor-pointer rounded-full px-1 text-ink-500 transition hover:bg-danger-400/15 hover:text-danger-400 disabled:opacity-60"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {nonMembers.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-line bg-pitch-800 px-3 py-1.5 text-xs text-ink-100 outline-none transition focus:border-volt-400"
          >
            <option value="">Agregar participante…</option>
            {nonMembers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={pending || !selected}
            className="shrink-0 cursor-pointer rounded-lg border border-volt-400/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-volt-400 transition hover:bg-volt-400/10 disabled:cursor-default disabled:opacity-50"
          >
            {pending ? "…" : "Agregar"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}
