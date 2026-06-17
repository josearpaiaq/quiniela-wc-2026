"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ListChecks, Database, Network, Trophy, Info } from "lucide-react";

const LINKS = [
  { href: "/quiniela", label: "Quiniela", icon: ListChecks },
  { href: "/bracket", label: "Bracket", icon: Network },
  { href: "/tabla", label: "Tabla", icon: Trophy },
  { href: "/reglas", label: "Reglas", icon: Info },
];

const ADMIN_LINK = { href: "/admin/resultados", label: "Admin", icon: Database };

// Params managed by nuqs that should travel between routes
const PERSISTENT_PARAMS = ["tab", "group", "gv", "day"];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-pitch-900/95 backdrop-blur md:static md:border-0 md:bg-transparent md:backdrop-blur-none">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around md:max-w-none md:justify-start md:gap-1">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <li key={link.href} className="flex-1 md:flex-none">
              <Link
                href={hrefWithParams(link.href)}
                className={`flex flex-col items-center gap-1 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-[11px] font-medium uppercase tracking-wider transition md:flex-row md:gap-1.5 md:rounded-lg md:px-3 md:py-2 md:text-xs ${
                  active
                    ? "text-volt-400 md:bg-volt-400/10"
                    : "text-ink-500 hover:text-ink-300"
                }`}
              >
                <link.icon aria-hidden className="h-5 w-5 md:h-4 md:w-4" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
