"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { pages, reviewActions, rowScores, students, submissions } from "@/lib/db/schema";
import { audit, getAssignmentForTeacher, getSubmissionForTeacher } from "@/lib/data";
import { enqueue } from "@/lib/jobs";
import { ensureSubmission, latestRunIds } from "@/lib/pipeline/run";
import { requireTeacher } from "@/lib/session";

function essayPath(assignmentId: string, studentId: string) {
  return `/assignments/${assignmentId}/students/${studentId}`;
}

/* ------------------------------------------------------------------ */
/* Transcription                                                       */
/* ------------------------------------------------------------------ */

export async function savePageText(pageId: string, text: string) {
  const teacher = await requireTeacher();
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page?.submissionId) throw new Error("Page not found.");
  const sub = await getSubmissionForTeacher(page.submissionId, teacher.id);
  if (!["needs_confirmation", "failed"].includes(sub.status)) {
    return { error: "This essay is already scored. Rescore it to change the transcription." } as const;
  }
  await db.update(pages).set({ confirmedText: text.slice(0, 20_000) }).where(eq(pages.id, page.id));
  await audit(teacher.id, "transcription.edit", "page", page.id);
  return { ok: true } as const;
}

/** Confirm the transcription and send the essay to scoring. */
export async function confirmAndScore(submissionId: string) {
  const teacher = await requireTeacher();
  const sub = await getSubmissionForTeacher(submissionId, teacher.id);
  if (sub.status !== "needs_confirmation" && sub.status !== "failed") return;

  if (sub.inputKind === "handwritten") {
    const subPages = await db.query.pages.findMany({ where: eq(pages.submissionId, sub.id) });
    for (const p of subPages) {
      if (p.status === "transcribed" && p.confirmedText === null) {
        await db.update(pages).set({ confirmedText: p.draftText ?? "" }).where(eq(pages.id, p.id));
      }
    }
  }
  await db
    .update(submissions)
    .set({ status: "scoring", confirmedAt: new Date(), confirmedBy: teacher.id, error: null })
    .where(eq(submissions.id, sub.id));
  await audit(teacher.id, "transcription.confirm", "submission", sub.id);
  await enqueue({ name: "submission/score", data: { submissionId: sub.id } });
  revalidatePath(essayPath(sub.assignmentId, sub.studentId));
  revalidatePath(`/assignments/${sub.assignmentId}`);
}

/** Score again from scratch. Earlier review decisions on this essay are replaced. */
export async function rescore(submissionId: string) {
  const teacher = await requireTeacher();
  const sub = await getSubmissionForTeacher(submissionId, teacher.id);
  if (!["scored", "failed", "approved"].includes(sub.status)) return;
  await db
    .update(submissions)
    .set({ status: "scoring", approvedAt: null, approvedBy: null, error: null })
    .where(eq(submissions.id, sub.id));
  await audit(teacher.id, "submission.rescore", "submission", sub.id);
  await enqueue({ name: "submission/score", data: { submissionId: sub.id } });
  revalidatePath(essayPath(sub.assignmentId, sub.studentId));
}

/** Stop scoring for every essay in the assignment that has not finished. */
export async function cancelScoring(assignmentId: string) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  const stopped = await db
    .update(submissions)
    .set({ status: "needs_confirmation" })
    .where(and(eq(submissions.assignmentId, assignment.id), eq(submissions.status, "scoring")))
    .returning({ id: submissions.id });
  await audit(teacher.id, "scoring.cancel", "assignment", assignment.id, { count: stopped.length });
  revalidatePath(`/assignments/${assignment.id}`);
}

/* ------------------------------------------------------------------ */
/* Typed essays                                                        */
/* ------------------------------------------------------------------ */

const TypedEssay = z.object({
  assignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  text: z.string().trim().min(20, "Paste the full essay.").max(30_000, "This essay is too long to score."),
});

export async function saveTypedEssayAndScore(
  _prev: { error?: string } | undefined,
  form: FormData,
): Promise<{ error?: string } | undefined> {
  const teacher = await requireTeacher();
  const parsed = TypedEssay.safeParse({
    assignmentId: form.get("assignmentId"),
    studentId: form.get("studentId"),
    text: form.get("text"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { assignmentId, studentId, text } = parsed.data;
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.classId, assignment.classId)),
  });
  if (!student) return { error: "Student not found." };

  const submissionId = await ensureSubmission(assignment.id, student.id, "typed");
  const sub = await db.query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
  if (sub && sub.inputKind === "handwritten") {
    const hasPages = await db.query.pages.findFirst({ where: eq(pages.submissionId, submissionId) });
    if (hasPages) return { error: "This student already has photographed pages for this assignment." };
  }
  await db
    .update(submissions)
    .set({ inputKind: "typed", typedText: text, status: "scoring", confirmedAt: new Date(), confirmedBy: teacher.id, error: null })
    .where(eq(submissions.id, submissionId));
  await audit(teacher.id, "submission.typed", "submission", submissionId);
  await enqueue({ name: "submission/score", data: { submissionId } });
  revalidatePath(essayPath(assignment.id, student.id));
  return {};
}

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

async function loadRow(rowId: string, teacherId: string) {
  const row = await db.query.rowScores.findFirst({ where: eq(rowScores.id, rowId) });
  if (!row) throw new Error("Score not found.");
  const sub = await getSubmissionForTeacher(row.submissionId, teacherId);
  if (sub.status !== "scored") throw new Error("Unapprove this essay to change its scores.");
  return { row, sub };
}

export async function acceptRow(rowId: string) {
  const teacher = await requireTeacher();
  const { row, sub } = await loadRow(rowId, teacher.id);
  if (row.points === null) return { error: "Set points for this row first." } as const;
  await db
    .update(rowScores)
    .set({ reviewStatus: row.reviewStatus === "adjusted" ? "adjusted" : "accepted", reviewedBy: teacher.id, reviewedAt: new Date() })
    .where(eq(rowScores.id, row.id));
  await db.insert(reviewActions).values({ rowScoreId: row.id, userId: teacher.id, action: "accept", before: { points: row.points }, after: { points: row.points } });
  revalidatePath(essayPath(sub.assignmentId, sub.studentId));
  return { ok: true } as const;
}

export async function adjustRow(rowId: string, points: number) {
  const teacher = await requireTeacher();
  const { row, sub } = await loadRow(rowId, teacher.id);
  if (!Number.isInteger(points) || points < 0 || points > row.maxPoints) {
    return { error: `Points must be between 0 and ${row.maxPoints}.` } as const;
  }
  await db
    .update(rowScores)
    .set({
      points,
      reviewStatus: points === row.aiPoints ? "accepted" : "adjusted",
      reviewedBy: teacher.id,
      reviewedAt: new Date(),
    })
    .where(eq(rowScores.id, row.id));
  await db.insert(reviewActions).values({
    rowScoreId: row.id,
    userId: teacher.id,
    action: "adjust_points",
    before: { points: row.points, aiPoints: row.aiPoints },
    after: { points },
  });
  revalidatePath(essayPath(sub.assignmentId, sub.studentId));
  return { ok: true } as const;
}

export async function editFeedback(rowId: string, text: string) {
  const teacher = await requireTeacher();
  const { row, sub } = await loadRow(rowId, teacher.id);
  const clean = text.trim().slice(0, 1500);
  await db.update(rowScores).set({ studentFeedback: clean }).where(eq(rowScores.id, row.id));
  await db.insert(reviewActions).values({
    rowScoreId: row.id,
    userId: teacher.id,
    action: "edit_feedback",
    before: { studentFeedback: row.studentFeedback },
    after: { studentFeedback: clean },
  });
  revalidatePath(essayPath(sub.assignmentId, sub.studentId));
  return { ok: true } as const;
}

/** Approve the essay: every unreviewed row is accepted as scored. Nothing reaches students before this. */
export async function approveSubmission(submissionId: string) {
  const teacher = await requireTeacher();
  const sub = await getSubmissionForTeacher(submissionId, teacher.id);
  if (sub.status !== "scored") return { error: "Only scored essays can be approved." } as const;
  const runId = (await latestRunIds([sub.id])).get(sub.id);
  if (!runId) return { error: "This essay has no scores yet." } as const;
  const rows = await db.query.rowScores.findMany({ where: eq(rowScores.scoreRunId, runId) });
  if (rows.some((r) => r.points === null)) return { error: "Set points for every row before approving." } as const;

  const pending = rows.filter((r) => r.reviewStatus === "pending");
  if (pending.length) {
    await db
      .update(rowScores)
      .set({ reviewStatus: "accepted", reviewedBy: teacher.id, reviewedAt: new Date() })
      .where(inArray(rowScores.id, pending.map((r) => r.id)));
    await db.insert(reviewActions).values(
      pending.map((r) => ({ rowScoreId: r.id, userId: teacher.id, action: "accept" as const, before: { points: r.points }, after: { points: r.points } })),
    );
  }
  await db.update(submissions).set({ status: "approved", approvedAt: new Date(), approvedBy: teacher.id }).where(eq(submissions.id, sub.id));
  await audit(teacher.id, "submission.approve", "submission", sub.id);
  revalidatePath(essayPath(sub.assignmentId, sub.studentId));
  revalidatePath(`/assignments/${sub.assignmentId}`);
  return { ok: true } as const;
}

export async function unapproveSubmission(submissionId: string) {
  const teacher = await requireTeacher();
  const sub = await getSubmissionForTeacher(submissionId, teacher.id);
  if (sub.status !== "approved") return;
  await db.update(submissions).set({ status: "scored", approvedAt: null, approvedBy: null }).where(eq(submissions.id, sub.id));
  await audit(teacher.id, "submission.unapprove", "submission", sub.id);
  revalidatePath(essayPath(sub.assignmentId, sub.studentId));
}
