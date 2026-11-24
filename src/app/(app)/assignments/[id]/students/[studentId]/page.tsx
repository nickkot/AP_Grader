import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";

import { ReviewView } from "@/app/(app)/assignments/[id]/students/[studentId]/review-view";
import { TypedEntry } from "@/app/(app)/assignments/[id]/students/[studentId]/typed-entry";
import { VerifyView } from "@/app/(app)/assignments/[id]/students/[studentId]/verify-view";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { pages, rowScores, submissions } from "@/lib/db/schema";
import { audit, getAssignmentForTeacher, getStudentForTeacher, studentName } from "@/lib/data";
import { latestRunIds } from "@/lib/pipeline/run";
import { getRubric } from "@/lib/rubrics";
import { presignDownload } from "@/lib/storage";
import { requireTeacher } from "@/lib/session";
import { reviewOrder, STATUS_LABEL, toStudentStatus } from "@/lib/views";

export const metadata: Metadata = { title: "Essay" };

export default async function StudentEssayPage(props: PageProps<"/assignments/[id]/students/[studentId]">) {
  const teacher = await requireTeacher();
  const { id, studentId } = await props.params;
  const assignment = await getAssignmentForTeacher(id, teacher.id);
  const student = await getStudentForTeacher(studentId, teacher.id);
  if (student.classId !== assignment.classId) return null;

  const rubric = getRubric(assignment.rubricKey, assignment.rubricVersion);
  const sub = await db.query.submissions.findFirst({
    where: and(eq(submissions.assignmentId, assignment.id), eq(submissions.studentId, student.id)),
  });
  const status = toStudentStatus(sub);
  const base = `/assignments/${assignment.id}`;

  // Neighbors for keyboard navigation and "next essay that needs review".
  const order = await reviewOrder(assignment.id, assignment.classId);
  const idx = order.findIndex((o) => o.studentId === student.id);
  const prev = idx > 0 ? order[idx - 1].studentId : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1].studentId : null;
  const rotated = [...order.slice(idx + 1), ...order.slice(0, idx)];
  const nextReview = rotated.find((o) => o.status === "needs_review")?.studentId ?? null;
  const nextCheck = rotated.find((o) => o.status === "check_transcription")?.studentId ?? null;

  const subPages = sub
    ? await db.query.pages.findMany({
        where: and(eq(pages.submissionId, sub.id), inArray(pages.status, ["transcribing", "transcribed", "failed"])),
        orderBy: asc(pages.pageNumber),
      })
    : [];
  const pageViews = await Promise.all(
    subPages.map(async (p) => ({
      id: p.id,
      pageNumber: p.pageNumber ?? 0,
      status: p.status,
      error: p.error,
      photoUrl: await presignDownload(p.originalKey),
      transcript: p.transcript ?? [],
      text: p.confirmedText ?? p.draftText ?? "",
      edited: p.confirmedText !== null && p.confirmedText !== p.draftText,
      lowConfidenceCount: p.lowConfidenceCount ?? 0,
      capturedAt: p.capturedAt.toISOString(),
    })),
  );

  let rows: Awaited<ReturnType<typeof db.query.rowScores.findMany>> = [];
  if (sub && (status === "needs_review" || status === "approved")) {
    const runId = (await latestRunIds([sub.id])).get(sub.id);
    if (runId) rows = await db.query.rowScores.findMany({ where: eq(rowScores.scoreRunId, runId) });
    await audit(teacher.id, "essay.view", "submission", sub.id);
  }

  const name = studentName(student);
  const meta = STATUS_LABEL[status];
  const working = status === "reading" || status === "scoring";

  return (
    <PageBody className="gap-4">
      <AutoRefresh active={working} />
      <PageHeader
        back={{ href: base, label: assignment.title }}
        title={<span title={name}>{name}</span>}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
            {sub?.inputKind === "typed" && <span>Typed essay</span>}
            {sub?.inputKind === "handwritten" && <span>{pageViews.length} pages</span>}
          </span>
        }
        actions={
          <>
            {prev && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`${base}/students/${prev}`}>Previous</Link>
              </Button>
            )}
            {next && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`${base}/students/${next}`}>Next</Link>
              </Button>
            )}
          </>
        }
      />

      {sub?.error && <p className="text-sm text-status-error">{sub.error}</p>}

      {status === "none" && (
        <TypedEntry assignmentId={assignment.id} studentId={student.id} uploadHref={`${base}/upload`} />
      )}

      {status === "reading" && (
        <p className="text-sm text-muted-foreground">
          Reading {pageViews.length} {pageViews.length === 1 ? "page" : "pages"}. This page updates when the transcription is ready.
        </p>
      )}

      {(status === "check_transcription" || (status === "failed" && sub?.inputKind === "handwritten" && pageViews.length > 0)) && sub && (
        <VerifyView
          submissionId={sub.id}
          pages={pageViews}
          nextHref={nextCheck ? `${base}/students/${nextCheck}` : null}
          prevHref={prev ? `${base}/students/${prev}` : null}
          nextStudentHref={next ? `${base}/students/${next}` : null}
        />
      )}

      {status === "failed" && sub?.inputKind === "typed" && (
        <TypedEntry assignmentId={assignment.id} studentId={student.id} uploadHref={`${base}/upload`} initialText={sub.typedText ?? ""} />
      )}

      {status === "scoring" && (
        <p className="text-sm text-muted-foreground">Scoring {rubric.rows.length} rubric rows. This page updates when scores are ready.</p>
      )}

      {(status === "needs_review" || status === "approved") && sub && (
        <ReviewView
          submission={{ id: sub.id, status: sub.status, inputKind: sub.inputKind, typedText: sub.typedText ?? "" }}
          rubric={rubric}
          rows={rows.map((r) => ({
            id: r.id,
            rowKey: r.rowKey,
            maxPoints: r.maxPoints,
            points: r.points,
            aiPoints: r.aiPoints,
            justification: r.justification,
            studentFeedback: r.studentFeedback,
            confidence: r.confidence,
            evidence: r.evidence,
            flags: r.flags,
            reviewStatus: r.reviewStatus,
            error: r.error,
          }))}
          pages={pageViews}
          nextReviewHref={nextReview ? `${base}/students/${nextReview}` : null}
          prevHref={prev ? `${base}/students/${prev}` : null}
          nextHref={next ? `${base}/students/${next}` : null}
          backHref={base}
        />
      )}
    </PageBody>
  );
}
