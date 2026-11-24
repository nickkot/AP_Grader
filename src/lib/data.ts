import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { assignments, auditEvents, classes, students, submissions } from "@/lib/db/schema";

/**
 * Ownership-checked reads. Every page and action loads records through these,
 * so a teacher can never reach another teacher's classes, students or essays.
 * (Row-level security by tenant comes with the full organization model; see docs/DECISIONS.md.)
 */

export async function getClassForTeacher(classId: string, teacherId: string) {
  if (!isUuid(classId)) notFound();
  const cls = await db.query.classes.findFirst({
    where: and(eq(classes.id, classId), eq(classes.teacherId, teacherId), isNull(classes.archivedAt)),
  });
  if (!cls) notFound();
  return cls;
}

export async function getAssignmentForTeacher(assignmentId: string, teacherId: string) {
  if (!isUuid(assignmentId)) notFound();
  const assignment = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, assignmentId), eq(assignments.teacherId, teacherId)),
  });
  if (!assignment) notFound();
  return assignment;
}

export async function getStudentForTeacher(studentId: string, teacherId: string) {
  if (!isUuid(studentId)) notFound();
  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.teacherId, teacherId)),
  });
  if (!student) notFound();
  return student;
}

export async function getSubmissionForTeacher(submissionId: string, teacherId: string) {
  if (!isUuid(submissionId)) notFound();
  const sub = await db.query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
  if (!sub) notFound();
  await getAssignmentForTeacher(sub.assignmentId, teacherId);
  return sub;
}

export async function rosterFor(classId: string) {
  return db
    .select()
    .from(students)
    .where(and(eq(students.classId, classId), isNull(students.removedAt)))
    .orderBy(asc(students.lastName), asc(students.firstName));
}

export function studentName(s: { firstName: string; lastName: string }) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ");
}

export async function audit(
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  meta?: Record<string, unknown>,
) {
  await db.insert(auditEvents).values({ userId, action, resourceType, resourceId, meta: meta ?? null });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string) {
  return UUID.test(value);
}

/** Parse a pasted roster: one student per line, "First Last" or "Last, First". Also accepts CSV with a header. */
export function parseRoster(text: string): { firstName: string; lastName: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase();
  const isCsv = /first/.test(header) && /last/.test(header) && header.includes(",");
  if (isCsv) {
    const cols = header.split(",").map((c) => c.trim());
    const fi = cols.findIndex((c) => c.includes("first"));
    const li = cols.findIndex((c) => c.includes("last"));
    return lines
      .slice(1)
      .map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")))
      .map((c) => ({ firstName: c[fi] ?? "", lastName: c[li] ?? "" }))
      .filter((s) => s.firstName || s.lastName);
  }

  return lines.map((line) => {
    if (line.includes(",")) {
      const [last, first] = line.split(",", 2).map((p) => p.trim());
      return { firstName: first ?? "", lastName: last ?? "" };
    }
    const parts = line.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
  });
}
