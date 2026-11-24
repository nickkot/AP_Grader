"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/practice", label: "Practice", match: (p: string) => p === "/practice" || p.startsWith("/practice/essays") },
  { href: "/practice/library", label: "Library", match: (p: string) => p.startsWith("/practice/library") || p.startsWith("/practice/prompts") },
];

export function StudentNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Practice" className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-control px-3 py-1.5 text-sm transition-colors duration-100",
              active ? "bg-primary-soft font-bold text-primary" : "text-foreground hover:bg-surface-muted",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
