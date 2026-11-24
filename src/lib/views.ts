import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { pages, rowScores, submissions, uploadBatches } from "@/lib/db/schema";
import { rosterFor } from "@/lib/data";
import { latestRunIds } from "@/lib/pipeline/run";
import { getRubric } from "@/lib/rubrics";
import type { Tone } from "@/components/ui/badge";

export type StudentStatus =
  | "none"
  | "reading"
  | "check_transcription"
  | "scoring"
  | "needs_review"
  | "approved"
  | "failed";

export const STATUS_LABEL: Record<StudentStatus, { label: string; tone: Tone }> = {
  none: { label: "No pages", tone: "neutral" },
  reading: { label: "Reading pages", tone: "progress" },
  check_transcription: { label: "Check transcription", tone: "review" },
  scoring: { label: "Scoring", tone: "progress" },
  needs_review: { label: "Needs review", tone: "review" },
  approved: { label: "Approved", tone: "ok" },
  failed: { label: "Failed", tone: "error" },
};

export type GridRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  submissionId: string | null;
  status: StudentStatus;
  error: string | null;
  pageCount: number;
  rows: Record<string, { points: number | null; flagged: boolean; reviewed: boolean }>;
  total: number | null;
  flaggedRows: number;
};

export function toStudentStatus(s: { status: string } | undefined): StudentStatus {
  switch (s?.status) {
    case undefined:
      return "none";
    case "transcribing":
      return "reading";
    case "needs_confirmation":
      return "check_transcription";
    case "scoring":
      return "scoring";
    case "scored":
      return "needs_review";
    case "approved":
      return "approved";
    default:
      return "failed";
  }
}

/** Everything the assignment page needs, in a handful of queries. */
export async function loadAssignmentGrid(assignment: { id: string; classId: string; rubricKey: string; rubricVersion: number }) {
  const rubric = getRubric(assignment.rubricKey, assignment.rubricVersion);
  const roster = await rosterFor(assignment.classId);
  const subs = await db.query.submissions.findMany({ where: eq(submissions.assignmentId, assignment.id) });
  const subByStudent = new Map(subs.map((s) => [s.studentId, s]));

  const pageCounts = await db
    .select({ submissionId: pages.submissionId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(pages)
    .where(and(eq(pages.assignmentId, assignment.id), inArray(pages.status, ["transcribing", "transcribed"])))
    .groupBy(pages.submissionId);
  const pagesBySub = new Map(pageCounts.map((p) => [p.submissionId, p.n]));

  const runIds = await latestRunIds(subs.map((s) => s.id));
  const scoreRows = runIds.size
    ? await db.query.rowScores.findMany({ where: inArray(rowScores.scoreRunId, [...runIds.values()]) })
    : [];
  const rowsBySub = new Map<string, typeof scoreRows>();
  for (const r of scoreRows) rowsBySub.set(r.submissionId, [...(rowsBySub.get(r.submissionId) ?? []), r]);

  const grid: GridRow[] = roster.map((st) => {
    const sub = subByStudent.get(st.id);
    const status = toStudentStatus(sub);
    const showScores = status === "needs_review" || status === "approved";
    const rows: GridRow["rows"] = {};
    let total: number | null = null;
    let flaggedRows = 0;
    if (sub && showScores) {
      total = 0;
      for (const r of rowsBySub.get(sub.id) ?? []) {
        const flagged = r.flags.length > 0 && r.reviewStatus === "pending";
        if (flagged) flaggedRows++;
        rows[r.rowKey] = { points: r.points, flagged, reviewed: r.reviewStatus !== "pending" };
        total += r.points ?? 0;
      }
    }
    return {
      studentId: st.id,
      firstName: st.firstName,
      lastName: st.lastName,
      submissionId: sub?.id ?? null,
      status,
      error: sub?.error ?? null,
      pageCount: sub ? (pagesBySub.get(sub.id) ?? 0) : 0,
      rows,
      total,
      flaggedRows,
    };
  });

  const pageStatus = await db
    .select({ status: pages.status, n: sql<number>`count(*)`.mapWith(Number) })
    .from(pages)
    .where(eq(pages.assignmentId, assignment.id))
    .groupBy(pages.status);
  const pagesBy = Object.fromEntries(pageStatus.map((p) => [p.status, p.n])) as Record<string, number>;
  const splittingPdfs = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(uploadBatches)
    .where(and(eq(uploadBatches.assignmentId, assignment.id), eq(uploadBatches.kind, "pdf"), eq(uploadBatches.status, "processing"), sql`${uploadBatches.pdfKey} is not null`));

  const count = (st: StudentStatus) => grid.filter((g) => g.status === st).length;
  return {
    rubric,
    grid,
    counts: {
      students: grid.length,
      none: count("none"),
      reading: count("reading"),
      check: count("check_transcription"),
      scoring: count("scoring"),
      review: count("needs_review"),
      approved: count("approved"),
      failed: count("failed"),
      unmatchedPages: pagesBy.unmatched ?? 0,
      workingPages: (pagesBy.uploaded ?? 0) + (pagesBy.processing ?? 0) + (pagesBy.transcribing ?? 0),
      totalPages: Object.values(pagesBy).reduce((a, b) => a + b, 0) - (pagesBy.failed ?? 0),
      splittingPdfs: splittingPdfs[0]?.n ?? 0,
    },
  };
}

/** Students in grid order, for "next essay" navigation in the review screen. */
export async function reviewOrder(assignmentId: string, classId: string) {
  const roster = await rosterFor(classId);
  const subs = await db
    .select({ studentId: submissions.studentId, status: submissions.status })
    .from(submissions)
    .where(eq(submissions.assignmentId, assignmentId))
    .orderBy(asc(submissions.createdAt));
  const statusBy = new Map(subs.map((s) => [s.studentId, toStudentStatus(s)]));
  return roster.map((s) => ({ studentId: s.id, status: statusBy.get(s.id) ?? ("none" as StudentStatus) }));
}
