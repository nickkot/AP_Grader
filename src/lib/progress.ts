import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { assignments, students, submissions } from "@/lib/db/schema";
import type { Segment } from "@/components/ui/progress";

export type StatusCounts = { approved: number; review: number; working: number; failed: number };

/** Submission status counts per assignment. */
export async function countsByAssignment(assignmentIds: string[]): Promise<Map<string, StatusCounts>> {
  const out = new Map<string, StatusCounts>();
  if (assignmentIds.length === 0) return out;
  const rows = await db
    .select({ assignmentId: submissions.assignmentId, status: submissions.status, n: sql<number>`count(*)`.mapWith(Number) })
    .from(submissions)
    .where(inArray(submissions.assignmentId, assignmentIds))
    .groupBy(submissions.assignmentId, submissions.status);
  for (const id of assignmentIds) out.set(id, { approved: 0, review: 0, working: 0, failed: 0 });
  for (const r of rows) {
    const c = r.assignmentId ? out.get(r.assignmentId) : undefined;
    if (!c) continue;
    if (r.status === "approved") c.approved += r.n;
    else if (r.status === "scored" || r.status === "needs_confirmation") c.review += r.n;
    else if (r.status === "failed") c.failed += r.n;
    else c.working += r.n;
  }
  return out;
}

export function segmentsFor(c: StatusCounts): Segment[] {
  return [
    { value: c.approved, tone: "done", label: "approved" },
    { value: c.review, tone: "review", label: "to review" },
    { value: c.working, tone: "working", label: "in progress" },
    { value: c.failed, tone: "error", label: "failed" },
  ];
}

export async function studentCount(classId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(students)
    .where(and(eq(students.classId, classId), isNull(students.removedAt)));
  return row?.n ?? 0;
}

export async function assignmentsForClass(classId: string) {
  return db.query.assignments.findMany({
    where: eq(assignments.classId, classId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
}
