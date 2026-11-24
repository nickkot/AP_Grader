import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";

import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav, type NavCourse } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { assignments, classes } from "@/lib/db/schema";
import { COURSES } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";

async function navFor(teacherId: string): Promise<NavCourse[]> {
  const rows = await db
    .select({ classId: classes.id, className: classes.name, course: classes.course, assignmentId: assignments.id, title: assignments.title })
    .from(classes)
    .leftJoin(assignments, eq(assignments.classId, classes.id))
    .where(and(eq(classes.teacherId, teacherId), isNull(classes.archivedAt)))
    .orderBy(asc(classes.course), asc(classes.name), asc(assignments.createdAt));

  const courses = new Map<string, NavCourse>();
  for (const r of rows) {
    const label = COURSES[r.course].label;
    const course = courses.get(label) ?? { label, classes: [] };
    courses.set(label, course);
    let cls = course.classes.find((c) => c.id === r.classId);
    if (!cls) {
      cls = { id: r.classId, name: r.className, assignments: [] };
      course.classes.push(cls);
    }
    if (r.assignmentId && r.title) cls.assignments.push({ id: r.assignmentId, title: r.title });
  }
  return [...courses.values()];
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const teacher = await requireTeacher();
  const courses = await navFor(teacher.id);

  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col self-start border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-6">
          <Link href="/classes" className="text-lg font-bold">
            {APP_NAME}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav courses={courses} />
        </div>
        <div className="flex items-center gap-3 border-t border-border px-4 py-3">
          <UserMenu name={teacher.name} email={teacher.email} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{teacher.name}</p>
            <p className="truncate text-xs text-muted-foreground">{teacher.email}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-2 lg:hidden">
          <MobileNav courses={courses} />
          <Link href="/classes" className="font-bold">
            {APP_NAME}
          </Link>
          <div className="ml-auto pr-2">
            <UserMenu name={teacher.name} email={teacher.email} />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
