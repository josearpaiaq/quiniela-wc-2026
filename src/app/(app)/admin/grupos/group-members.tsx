"use client";

import { useState, useTransition } from "react";
import { addGroupMembers, removeGroupMember } from "@/lib/actions/groups";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function add() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const result = await addGroupMembers({ groupId, userIds: [...selected] });
      setError(result.ok ? null : result.error);
      if (result.ok) setSelected(new Set());
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
        <details className="group rounded-lg border border-line bg-pitch-800/50 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-medium text-ink-500 transition hover:text-volt-400">
            <span className="group-open:hidden">+ Agregar participantes</span>
            <span className="hidden group-open:inline">Selecciona a quién agregar</span>
          </summary>
          <div className="space-y-2 pt-2">
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {nonMembers.map((user) => (
                <li key={user.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-ink-300 transition hover:bg-pitch-800">
                    <input
                      type="checkbox"
                      checked={selected.has(user.id)}
                      onChange={() => toggle(user.id)}
                      className="size-3.5 cursor-pointer accent-volt-400"
                    />
                    {user.name}
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={add}
              disabled={pending || selected.size === 0}
              className="cursor-pointer rounded-lg border border-volt-400/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-volt-400 transition hover:bg-volt-400/10 disabled:cursor-default disabled:opacity-50"
            >
              {pending
                ? "Agregando…"
                : selected.size > 0
                  ? `Agregar (${selected.size})`
                  : "Agregar"}
            </button>
          </div>
        </details>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}
