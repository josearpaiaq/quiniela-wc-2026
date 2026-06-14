"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { href: "/admin/resultados", label: "Resultados" },
  { href: "/admin/grupos", label: "Grupos" },
  { href: "/admin/usuarios", label: "Usuarios" },
] as const;

const PERSISTENT_PARAMS = ["tab", "group", "gv", "day"];

export function AdminTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  const searchParams = useSearchParams();

  function hrefWithParams(href: string) {
    const carry = new URLSearchParams();
    for (const key of PERSISTENT_PARAMS) {
      const val = searchParams.get(key);
      if (val) carry.set(key, val);
    }
    const qs = carry.toString();
    return qs ? `${href}?${qs}` : href;
  }

  return (
    <nav className="flex gap-1 rounded-lg border border-line p-0.5 self-start">
      {TABS.map(({ href, label }) => (
        <Link
          key={href}
          href={hrefWithParams(href)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
            active === href ? "bg-volt-400 text-pitch-950" : "text-ink-500 hover:text-ink-300"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
