import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";

import { AddStudentsDialog } from "@/app/(app)/classes/[classId]/add-students-dialog";
import { EmptyState, PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { assignments, submissions } from "@/lib/db/schema";
import { getClassForTeacher, rosterFor, studentName } from "@/lib/data";
import { COURSES, ESSAY_TYPES } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage(props: PageProps<"/classes/[classId]">) {
  const teacher = await requireTeacher();
  const { classId } = await props.params;
  const cls = await getClassForTeacher(classId, teacher.id);
  const roster = await rosterFor(cls.id);

  const list = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      essayType: assignments.essayType,
      createdAt: assignments.createdAt,
      scored: sql<number>`count(${submissions.id}) filter (where ${submissions.status} in ('scored','approved'))`.mapWith(Number),
      approved: sql<number>`count(${submissions.id}) filter (where ${submissions.status} = 'approved')`.mapWith(Number),
    })
    .from(assignments)
    .leftJoin(submissions, eq(submissions.assignmentId, assignments.id))
    .where(eq(assignments.classId, cls.id))
    .groupBy(assignments.id)
    .orderBy(desc(assignments.createdAt));

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/classes", label: "Classes" }}
        title={cls.name}
        description={`${COURSES[cls.course].label} · ${roster.length} students`}
        actions={
          <Button asChild>
            <Link href={`/assignments/new?classId=${cls.id}`}>Create assignment</Link>
          </Button>
        }
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Assignments</h2>
        {list.length === 0 ? (
          <EmptyState>No assignments yet. Create one to print answer sheets for this class.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead className="w-40">Type</TableHead>
                <TableHead className="w-32 text-right">Scored</TableHead>
                <TableHead className="w-32 text-right">Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id} className="hover:bg-surface-muted">
                  <TableCell className="max-w-0">
                    <Link href={`/assignments/${a.id}`} className="block truncate font-semibold hover:underline" title={a.title}>
                      {a.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ESSAY_TYPES[a.essayType].shortLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.scored} of {roster.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.approved}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Roster</h2>
          <AddStudentsDialog classId={cls.id} />
        </div>
        {roster.length === 0 ? (
          <EmptyState>No students yet. Add your roster to print personalized answer sheets.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-0 truncate" title={studentName(s)}>
                    {s.lastName ? `${s.lastName}, ${s.firstName}` : s.firstName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </PageBody>
  );
}
