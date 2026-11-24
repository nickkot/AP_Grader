import "server-only";
import { and, eq, isNull, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { qrTokens } from "@/lib/db/schema";
import { generateQrToken } from "@/lib/packet/order";

/**
 * Make sure every student has a QR token for every answer page, plus the requested
 * number of spare sets. Existing tokens are reused, so a reprinted packet carries the
 * same codes as the first print and old sheets still match.
 */
export async function ensurePacketTokens(opts: {
  assignmentId: string;
  studentIds: string[];
  pagesPerStudent: number;
  spareSets: number;
}) {
  const { assignmentId, studentIds, pagesPerStudent, spareSets } = opts;

  const existing = await db.query.qrTokens.findMany({ where: eq(qrTokens.assignmentId, assignmentId) });
  const have = new Set(existing.filter((t) => t.studentId).map((t) => `${t.studentId}:${t.pageNumber}`));

  const toInsert: (typeof qrTokens.$inferInsert)[] = [];
  for (const studentId of studentIds) {
    for (let page = 1; page <= pagesPerStudent; page++) {
      if (!have.has(`${studentId}:${page}`)) {
        toInsert.push({ token: generateQrToken(), assignmentId, studentId, pageNumber: page, pageCount: pagesPerStudent });
      }
    }
  }

  const spareSetNumbers = new Set(existing.filter((t) => !t.studentId).map((t) => t.spareSet ?? 0));
  const haveSpare = new Set(existing.filter((t) => !t.studentId).map((t) => `${t.spareSet}:${t.pageNumber}`));
  for (let set = 1; set <= spareSets; set++) {
    for (let page = 1; page <= pagesPerStudent; page++) {
      if (!haveSpare.has(`${set}:${page}`)) {
        toInsert.push({ token: generateQrToken(), assignmentId, studentId: null, pageNumber: page, pageCount: pagesPerStudent, spareSet: set });
      }
    }
    spareSetNumbers.add(set);
  }

  if (toInsert.length) await db.insert(qrTokens).values(toInsert).onConflictDoNothing();

  // Keep "Page N of M" consistent with the latest print.
  await db.update(qrTokens).set({ pageCount: pagesPerStudent }).where(eq(qrTokens.assignmentId, assignmentId));

  const all = await db.query.qrTokens.findMany({ where: eq(qrTokens.assignmentId, assignmentId) });
  return {
    studentTokens: all.filter((t) => t.studentId && t.pageNumber <= pagesPerStudent),
    spareTokens: all.filter((t) => !t.studentId && (t.spareSet ?? 0) <= spareSets && t.pageNumber <= pagesPerStudent),
  };
}

export async function spareTokenCount(assignmentId: string) {
  const rows = await db
    .select({ token: qrTokens.token })
    .from(qrTokens)
    .where(and(eq(qrTokens.assignmentId, assignmentId), isNull(qrTokens.studentId)));
  return rows.length;
}

export async function studentTokenCount(assignmentId: string) {
  const rows = await db
    .select({ token: qrTokens.token })
    .from(qrTokens)
    .where(and(eq(qrTokens.assignmentId, assignmentId), isNotNull(qrTokens.studentId)));
  return rows.length;
}
