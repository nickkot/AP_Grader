import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq, isNull, sql } from "drizzle-orm";

import { EmptyState, PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { assignments, classes, students } from "@/lib/db/schema";
import { COURSES, type Course } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const teacher = await requireTeacher();

  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      course: classes.course,
      students: sql<number>`(select count(*) from ${students} where ${students.classId} = ${classes.id} and ${students.removedAt} is null)`.mapWith(Number),
      assignments: count(assignments.id),
    })
    .from(classes)
    .leftJoin(assignments, eq(assignments.classId, classes.id))
    .where(and(eq(classes.teacherId, teacher.id), isNull(classes.archivedAt)))
    .groupBy(classes.id)
    .orderBy(classes.course, classes.name);

  const byCourse = new Map<Course, typeof rows>();
  for (const r of rows) byCourse.set(r.course, [...(byCourse.get(r.course) ?? []), r]);

  return (
    <PageBody>
      <PageHeader
        title="Classes"
        actions={
          <Button asChild>
            <Link href="/classes/new">Create class</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="outline">
              <Link href="/classes/new">Create your first class</Link>
            </Button>
          }
        >
          No classes yet. Create a class and paste your roster to start.
        </EmptyState>
      ) : (
        [...byCourse.entries()].map(([course, list]) => (
          <section key={course} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">
              {COURSES[course].label}
              <span className="ml-2 font-normal text-muted-foreground">{list.map((c) => c.name).join(", ")}</span>
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="w-32 text-right">Students</TableHead>
                  <TableHead className="w-32 text-right">Assignments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id} className="hover:bg-surface-muted">
                    <TableCell>
                      <Link href={`/classes/${c.id}`} className="font-semibold hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.students}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.assignments}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ))
      )}
    </PageBody>
  );
}
