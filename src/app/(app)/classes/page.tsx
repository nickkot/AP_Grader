import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { EmptyState, PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LinkCard } from "@/components/ui/card";
import { SegmentedProgress } from "@/components/ui/progress";
import { db } from "@/lib/db";
import { assignments, classes, students, submissions } from "@/lib/db/schema";
import { COURSES, type Course } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const teacher = await requireTeacher();

  const base = await db
    .select({ id: classes.id, name: classes.name, course: classes.course })
    .from(classes)
    .where(and(eq(classes.teacherId, teacher.id), isNull(classes.archivedAt)))
    .orderBy(classes.course, classes.name);
  const ids = base.map((c) => c.id);

  const n = sql<number>`count(*)`.mapWith(Number);
  const studentRows = ids.length
    ? await db.select({ classId: students.classId, n }).from(students).where(and(inArray(students.classId, ids), isNull(students.removedAt))).groupBy(students.classId)
    : [];
  const assignmentRows = ids.length
    ? await db.select({ classId: assignments.classId, n }).from(assignments).where(inArray(assignments.classId, ids)).groupBy(assignments.classId)
    : [];
  const statusRows = ids.length
    ? await db
        .select({ classId: assignments.classId, status: submissions.status, n })
        .from(submissions)
        .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
        .where(inArray(assignments.classId, ids))
        .groupBy(assignments.classId, submissions.status)
    : [];

  const countFor = (list: { classId: string; n: number }[], id: string) => list.find((r) => r.classId === id)?.n ?? 0;
  const rows = base.map((c) => ({
    ...c,
    students: countFor(studentRows, c.id),
    assignments: countFor(assignmentRows, c.id),
    approved: statusRows.filter((r) => r.classId === c.id && r.status === "approved").reduce((s, r) => s + r.n, 0),
    review: statusRows
      .filter((r) => r.classId === c.id && (r.status === "scored" || r.status === "needs_confirmation"))
      .reduce((s, r) => s + r.n, 0),
  }));

  const byCourse = new Map<Course, typeof rows>();
  for (const r of rows) byCourse.set(r.course, [...(byCourse.get(r.course) ?? []), r]);

  return (
    <PageBody>
      <PageHeader
        title="Classes"
        description={rows.length ? `${pluralize(rows.length, "class", "classes")} across ${pluralize(byCourse.size, "course")}` : undefined}
        actions={
          rows.length ? (
            <Button asChild variant="outline">
              <Link href="/classes/new">Create class</Link>
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/classes/new">Create class</Link>
            </Button>
          }
        >
          No classes yet. Create a class and paste your roster to start.
        </EmptyState>
      ) : (
        [...byCourse.entries()].map(([course, list]) => (
          <section key={course} className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">{COURSES[course].label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((c) => {
                const total = c.students * c.assignments;
                return (
                  <LinkCard key={c.id} href={`/classes/${c.id}`} className="flex flex-col gap-4">
                    <div>
                      <p className="truncate text-lg font-bold" title={c.name}>
                        {c.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {pluralize(c.students, "student")} · {pluralize(c.assignments, "assignment")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <SegmentedProgress
                        label="Essays"
                        total={total}
                        segments={[
                          { value: c.approved, tone: "done", label: "approved" },
                          { value: c.review, tone: "review", label: "to review" },
                        ]}
                      />
                      <p className="text-sm text-muted-foreground">
                        {c.review > 0 ? `${c.review} to review · ` : ""}
                        {c.approved} approved
                      </p>
                    </div>
                  </LinkCard>
                );
              })}
            </div>
          </section>
        ))
      )}
    </PageBody>
  );
}
