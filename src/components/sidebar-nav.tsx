"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelpIcon, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type NavCourse = {
  label: string;
  classes: { id: string; name: string; assignments: { id: string; title: string }[] }[];
};

/** Course-grouped navigation: classes with their assignments nested, current page marked. */
export function SidebarNav({ courses, onNavigate }: { courses: NavCourse[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const item = (href: string, active: boolean) =>
    cn(
      "flex min-h-9 items-center rounded-control px-3 py-1.5 text-sm transition-colors duration-100",
      active ? "bg-primary-soft font-bold text-primary" : "text-foreground hover:bg-surface-muted",
    );

  return (
    <nav aria-label="Classes" className="flex flex-col gap-6">
      <Link href="/classes" onClick={onNavigate} className={item("/classes", pathname === "/classes")}>
        All classes
      </Link>
      {courses.map((course) => (
        <div key={course.label} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">{course.label}</p>
          {course.classes.map((cls) => (
            <div key={cls.id} className="flex flex-col">
              <Link
                href={`/classes/${cls.id}`}
                onClick={onNavigate}
                className={cn(item(`/classes/${cls.id}`, pathname === `/classes/${cls.id}`), "font-bold")}
                aria-current={pathname === `/classes/${cls.id}` ? "page" : undefined}
              >
                <span className="truncate">{cls.name}</span>
              </Link>
              {cls.assignments.length > 0 && (
                <ul className="ml-3 flex flex-col border-l border-border pl-2">
                  {cls.assignments.map((a) => {
                    const href = `/assignments/${a.id}`;
                    const active = isActive(href);
                    return (
                      <li key={a.id}>
                        <Link
                          href={href}
                          onClick={onNavigate}
                          className={item(href, active)}
                          aria-current={active ? "page" : undefined}
                          title={a.title}
                        >
                          <span className="truncate">{a.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      ))}
      <Link href="/classes/new" onClick={onNavigate} className={cn(item("/classes/new", isActive("/classes/new")), "gap-2 text-primary")}>
        <PlusIcon className="size-4" aria-hidden />
        Create class
      </Link>
      <Link
        href="/how-it-works"
        onClick={onNavigate}
        className={cn(item("/how-it-works", pathname === "/how-it-works"), "gap-2")}
        aria-current={pathname === "/how-it-works" ? "page" : undefined}
      >
        <CircleHelpIcon className="size-4" aria-hidden />
        How it works
      </Link>
    </nav>
  );
}
