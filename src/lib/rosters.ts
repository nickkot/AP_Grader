import "server-only";
import { eq, max } from "drizzle-orm";

import { db } from "@/lib/db";
import { classes, students } from "@/lib/db/schema";
import { compareStudents } from "@/lib/student-names";

/** Students numbered from `from`, with no names stored. */
export function numberedStudents(classId: string, teacherId: string, from: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({ classId, teacherId, firstName: "", lastName: "", number: from + i }));
}

export async function nextStudentNumber(classId: string) {
  const [{ highest }] = await db.select({ highest: max(students.number) }).from(students).where(eq(students.classId, classId));
  return (highest ?? 0) + 1;
}

/**
 * Every student in a named class, in the order they would be numbered: the current
 * roster first, then students removed from it. The key and the switch both use this order.
 */
export async function numberingOrder(classId: string) {
  const all = await db.select().from(students).where(eq(students.classId, classId));
  const current = all.filter((s) => !s.removedAt).sort(compareStudents);
  const removed = all.filter((s) => s.removedAt).sort(compareStudents);
  return [...current, ...removed].map((s, i) => ({ ...s, newNumber: i + 1 }));
}

/**
 * Replace every name in a class with a number, permanently. `orderedIds` must match the
 * key the teacher downloaded; if the roster changed since, nothing is replaced.
 */
export async function replaceNames(classId: string, orderedIds: string[]) {
  const order = await numberingOrder(classId);
  if (orderedIds.length !== order.length || order.some((s, i) => s.id !== orderedIds[i])) {
    return { error: "The roster changed after you downloaded the key. Download the key again." } as const;
  }
  await db.transaction(async (tx) => {
    for (const s of order) {
      await tx.update(students).set({ firstName: "", lastName: "", number: s.newNumber }).where(eq(students.id, s.id));
    }
    await tx.update(classes).set({ rosterKind: "numbers" }).where(eq(classes.id, classId));
  });
  return { ok: true, students: order.length } as const;
}
