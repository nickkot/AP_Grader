import type { Metadata } from "next";
import Link from "next/link";

import { CancelScoringButton } from "@/app/(app)/assignments/[id]/cancel-scoring-button";
import { PrintDialog } from "@/app/(app)/assignments/[id]/print-dialog";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState, PageBody, PageHeader } from "@/components/page-header";
import { StatusBadge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, Tooltip } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAssignmentForTeacher, getClassForTeacher } from "@/lib/data";
import { COURSES, ESSAY_TYPES } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";
import { loadAssignmentGrid, STATUS_LABEL } from "@/lib/views";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Assignment" };

export default async function AssignmentPage(props: PageProps<"/assignments/[id]">) {
  const teacher = await requireTeacher();
  const { id } = await props.params;
  const assignment = await getAssignmentForTeacher(id, teacher.id);
  const cls = await getClassForTeacher(assignment.classId, teacher.id);
  const { rubric, grid, counts } = await loadAssignmentGrid(assignment);
  const essayType = ESSAY_TYPES[assignment.essayType];
  const base = `/assignments/${assignment.id}`;

  const firstCheck = grid.find((g) => g.status === "check_transcription");
  const firstReview = grid.find((g) => g.status === "needs_review" && g.flaggedRows > 0) ?? grid.find((g) => g.status === "needs_review");
  const working = counts.reading + counts.scoring + counts.workingPages + counts.splittingPdfs > 0;
  const anyPages = counts.totalPages > 0 || grid.some((g) => g.status !== "none");

  // Exactly one primary action, chosen by what the teacher should do next.
  let primary: "print" | "check" | "review" | "upload" = "upload";
  if (counts.students > 0 && !anyPages) primary = "print";
  else if (firstReview) primary = "review";
  else if (firstCheck) primary = "check";

  const scoredOrApproved = counts.review + counts.approved;
  const progressTotal = counts.students - counts.none;
  const progressDone = scoredOrApproved + counts.failed + counts.check;

  return (
    <PageBody>
      <AutoRefresh active={working} />
      <PageHeader
        back={{ href: `/classes/${cls.id}`, label: cls.name }}
        title={assignment.title}
        description={`${COURSES[cls.course].label} · ${essayType.label} · ${rubric.maxPoints} points`}
        actions={
          <>
            {primary === "review" && firstReview && (
              <Button asChild>
                <Link href={`${base}/students/${firstReview.studentId}`}>Review {pluralize(counts.review, "essay")}</Link>
              </Button>
            )}
            {primary === "check" && firstCheck && (
              <Button asChild>
                <Link href={`${base}/students/${firstCheck.studentId}`}>Check {pluralize(counts.check, "transcription")}</Link>
              </Button>
            )}
            <PrintDialog
              assignmentId={assignment.id}
              studentCount={counts.students}
              defaultPages={assignment.answerPagesPerStudent}
              primary={primary === "print"}
            />
            <Button asChild variant={primary === "upload" ? "default" : "outline"}>
              <Link href={`${base}/upload`}>Upload photos</Link>
            </Button>
            {scoredOrApproved > 0 && (
              <Button asChild variant="ghost">
                <a href={`/api/assignments/${assignment.id}/export`} download>
                  Export CSV
                </a>
              </Button>
            )}
          </>
        }
      />

      {counts.unmatchedPages > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface px-4 py-3 text-sm">
          <StatusDot tone="review" />
          <span>{pluralize(counts.unmatchedPages, "page")} could not be matched to a student.</span>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={`${base}/match`}>Match pages</Link>
          </Button>
        </div>
      )}

      {progressTotal > 0 && (counts.reading > 0 || counts.scoring > 0 || counts.workingPages > 0 || counts.splittingPdfs > 0) && (
        <div className="flex flex-col gap-2 rounded-panel border border-border bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {counts.splittingPdfs > 0 && <span>Splitting {pluralize(counts.splittingPdfs, "PDF")} into pages</span>}
            {counts.workingPages > 0 && <span>Reading {pluralize(counts.workingPages, "page")}</span>}
            {counts.scoring > 0 && <span>Scoring {pluralize(counts.scoring, "essay")}</span>}
            <span className="text-muted-foreground">
              {progressDone} of {progressTotal} ready
            </span>
            {counts.scoring > 0 && (
              <span className="ml-auto">
                <CancelScoringButton assignmentId={assignment.id} />
              </span>
            )}
          </div>
          <Progress value={progressTotal ? (progressDone / progressTotal) * 100 : 0} aria-label="Batch progress" />
        </div>
      )}

      {counts.students === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="outline">
              <Link href={`/classes/${cls.id}`}>Add students</Link>
            </Button>
          }
        >
          This class has no students yet. Add your roster to print answer sheets.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">Student</TableHead>
              <TableHead className="w-40">Status</TableHead>
              {rubric.rows.map((r) => (
                <TableHead key={r.key} className="w-24 text-right" title={r.label}>
                  <span className="block truncate">{r.label}</span>
                </TableHead>
              ))}
              <TableHead className="w-20 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grid.map((g) => {
              const name = g.lastName ? `${g.lastName}, ${g.firstName}` : g.firstName;
              const meta = STATUS_LABEL[g.status];
              return (
                <TableRow key={g.studentId} className="hover:bg-surface-muted">
                  <TableCell className="max-w-56">
                    <Link
                      href={`${base}/students/${g.studentId}`}
                      className="block truncate font-semibold hover:underline"
                      title={name}
                    >
                      {name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {g.error ? (
                      <Tooltip content={g.error}>
                        <span>
                          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                        </span>
                      </Tooltip>
                    ) : (
                      <StatusBadge tone={meta.tone}>
                        {meta.label}
                        {g.status === "needs_review" && g.flaggedRows > 0 ? ` (${g.flaggedRows})` : ""}
                      </StatusBadge>
                    )}
                  </TableCell>
                  {rubric.rows.map((r) => {
                    const cell = g.rows[r.key];
                    return (
                      <TableCell key={r.key} className="text-right tabular-nums">
                        {cell ? (
                          <span className="inline-flex items-center gap-1.5">
                            {cell.flagged && <StatusDot tone="review" />}
                            <span>
                              {cell.points ?? "?"}
                              <span className="text-muted-foreground">/{r.maxPoints}</span>
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold tabular-nums">
                    {g.total !== null ? `${g.total}/${rubric.maxPoints}` : <span className="font-normal text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <p className="text-xs text-muted-foreground">
        Scores stay private until you approve them. A dot marks a row to check: low confidence, a close call, or a quote that
        could not be found in the essay.
      </p>
    </PageBody>
  );
}
