"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecks, Mic, Network, Trophy } from "lucide-react";

const LINKS = [
  { href: "/quiniela", label: "Quiniela", icon: ListChecks },
  { href: "/bracket", label: "Bracket", icon: Network },
  { href: "/tabla", label: "Tabla", icon: Trophy },
];

const ADMIN_LINK = { href: "/admin/resultados", label: "Admin", icon: Mic };

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...LINKS, ADMIN_LINK] : LINKS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-pitch-900/95 backdrop-blur md:static md:border-0 md:bg-transparent md:backdrop-blur-none">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around md:max-w-none md:justify-start md:gap-1">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <li key={link.href} className="flex-1 md:flex-none">
              <Link
                href={link.href}
                className={`flex flex-col items-center gap-0.5 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-[11px] font-medium uppercase tracking-wider transition md:flex-row md:gap-1.5 md:rounded-lg md:px-3 md:py-2 md:text-xs ${
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
