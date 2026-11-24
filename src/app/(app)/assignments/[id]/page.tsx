import type { Metadata } from "next";
import Link from "next/link";

import { CancelScoringButton } from "@/app/(app)/assignments/[id]/cancel-scoring-button";
import { PrintDialog } from "@/app/(app)/assignments/[id]/print-dialog";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState, PageBody, PageHeader, PhoneActions, SectionTitle } from "@/components/page-header";
import { Pill, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banner, Card, CardContent, UpNext } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/misc";
import { MasteryCell, MasteryLegend, ProgressLegend, SegmentedProgress, type Segment } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAssignmentForTeacher, getClassForTeacher } from "@/lib/data";
import { COURSES, ESSAY_TYPES } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";
import { loadAssignmentGrid, STATUS_LABEL } from "@/lib/views";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Assignment" };

type Next = "add_students" | "print" | "review" | "check" | "upload" | "export";

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
  const flaggedTotal = grid.reduce((s, g) => s + (g.status === "needs_review" ? g.flaggedRows : 0), 0);
  const scoredOrApproved = counts.review + counts.approved;

  // The single next step, chosen by what the teacher should do now.
  let next: Next;
  if (counts.students === 0) next = "add_students";
  else if (firstReview) next = "review";
  else if (firstCheck) next = "check";
  else if (!anyPages) next = "print";
  else if (counts.none > 0) next = "upload";
  else next = "export";

  const printDialog = (primary: boolean) => (
    <PrintDialog assignmentId={assignment.id} studentCount={counts.students} defaultPages={assignment.answerPagesPerStudent} primary={primary} />
  );
  const exportLink = (variant: "default" | "tertiary") => (
    <Button asChild variant={variant}>
      <a href={`/api/assignments/${assignment.id}/export`} download>
        Export CSV
      </a>
    </Button>
  );

  const upNext: Record<Next, React.ReactNode> = {
    add_students: (
      <UpNext
        title="Add students to this class"
        reason="Answer sheets carry each student's name and QR code."
        action={
          <Button asChild>
            <Link href={`/classes/${cls.id}`}>Add students</Link>
          </Button>
        }
      />
    ),
    print: (
      <UpNext
        title="Print the answer sheets"
        reason={`One PDF with the prompt, the documents and a QR-coded set of pages for each of ${pluralize(counts.students, "student")}.`}
        action={printDialog(true)}
      />
    ),
    review: firstReview ? (
      <UpNext
        title={`Review ${pluralize(counts.review, "essay")}`}
        reason={flaggedTotal > 0 ? `${pluralize(flaggedTotal, "row")} flagged for a closer look. Start with those.` : "Scores are ready. Approve each essay to share it."}
        action={
          <Button asChild>
            <Link href={`${base}/students/${firstReview.studentId}`}>Start reviewing</Link>
          </Button>
        }
      />
    ) : null,
    check: firstCheck ? (
      <UpNext
        title={`Check ${pluralize(counts.check, "transcription")}`}
        reason="Compare each transcription with the photo, then send it to scoring."
        action={
          <Button asChild>
            <Link href={`${base}/students/${firstCheck.studentId}`}>Start checking</Link>
          </Button>
        }
      />
    ) : null,
    upload: (
      <UpNext
        title="Upload the rest of the pages"
        reason={`${pluralize(counts.none, "student")} ${counts.none === 1 ? "has" : "have"} no pages yet.`}
        action={
          <Button asChild>
            <Link href={`${base}/upload`}>Upload photos</Link>
          </Button>
        }
      />
    ),
    export: (
      <UpNext
        title="Export the scores"
        reason={`${pluralize(counts.approved, "essay")} approved.`}
        action={exportLink("default")}
      />
    ),
  };

  const secondaryActions = (
    <>
      {next !== "print" && next !== "add_students" && printDialog(false)}
      {next !== "upload" && next !== "add_students" && (
        <Button asChild variant="outline">
          <Link href={`${base}/upload`}>Upload photos</Link>
        </Button>
      )}
      {scoredOrApproved > 0 && next !== "export" && exportLink("tertiary")}
    </>
  );

  const segments: Segment[] = [
    { value: counts.approved, tone: "done", label: "approved" },
    { value: counts.review + counts.check, tone: "review", label: "to review or check" },
    { value: counts.reading + counts.scoring, tone: "working", label: "in progress" },
    { value: counts.failed, tone: "error", label: "failed" },
  ];

  // How many students earned each row, among scored essays.
  const scoredRows = grid.filter((g) => g.status === "needs_review" || g.status === "approved");
  const earnedBy = (key: string, max: number) => scoredRows.filter((g) => (g.rows[key]?.points ?? -1) >= max).length;

  return (
    <PageBody>
      <AutoRefresh active={working} />
      <PageHeader
        back={{ href: `/classes/${cls.id}`, label: cls.name }}
        title={assignment.title}
        description={`${COURSES[cls.course].label} · ${essayType.label} · ${rubric.maxPoints} points`}
        actionsOnPhone={false}
        actions={secondaryActions}
      />

      {upNext[next]}
      <PhoneActions>{secondaryActions}</PhoneActions>

      {counts.unmatchedPages > 0 && (
        <Banner
          tone="warning"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}/match`}>Match pages</Link>
            </Button>
          }
        >
          {pluralize(counts.unmatchedPages, "page")} could not be matched to a student.
        </Banner>
      )}

      {counts.students > 0 && anyPages && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-bold">
                {counts.students - counts.none} of {pluralize(counts.students, "student")} have pages
              </p>
              {(counts.workingPages > 0 || counts.splittingPdfs > 0 || counts.scoring > 0) && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {counts.splittingPdfs > 0 && <span>Splitting {pluralize(counts.splittingPdfs, "PDF")} into pages</span>}
                  {counts.workingPages > 0 && <span>Reading {pluralize(counts.workingPages, "page")}</span>}
                  {counts.scoring > 0 && <span>Scoring {pluralize(counts.scoring, "essay")}</span>}
                  {counts.scoring > 0 && <CancelScoringButton assignmentId={assignment.id} />}
                </div>
              )}
            </div>
            <SegmentedProgress label="Class progress" segments={segments} total={counts.students} />
            <ProgressLegend segments={segments.filter((s) => s.value > 0 || s.tone === "done")} />
          </CardContent>
        </Card>
      )}

      {counts.students === 0 ? (
        <EmptyState>This class has no students yet.</EmptyState>
      ) : (
        <section className="flex flex-col gap-4">
          <SectionTitle>Rubric results</SectionTitle>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Student</TableHead>
                <TableHead className="w-44">Status</TableHead>
                {rubric.rows.map((r) => (
                  <TableHead key={r.key} className="w-28 text-center" title={r.label}>
                    <span className="mx-auto block max-w-24 truncate">{r.label}</span>
                  </TableHead>
                ))}
                <TableHead className="w-20 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grid.map((g) => {
                const name = g.lastName ? `${g.lastName}, ${g.firstName}` : g.firstName;
                const meta = STATUS_LABEL[g.status];
                const badge = (
                  <StatusBadge tone={meta.tone}>
                    {meta.label}
                    {g.status === "needs_review" && g.flaggedRows > 0 ? ` (${g.flaggedRows})` : ""}
                  </StatusBadge>
                );
                return (
                  <TableRow key={g.studentId} className="hover:bg-canvas">
                    <TableCell className="max-w-56">
                      <Link
                        href={`${base}/students/${g.studentId}`}
                        className="block truncate text-base font-bold text-primary hover:underline underline-offset-4"
                        title={name}
                      >
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {g.error ? (
                        <Tooltip content={g.error}>
                          <span>{badge}</span>
                        </Tooltip>
                      ) : (
                        badge
                      )}
                    </TableCell>
                    {rubric.rows.map((r) => {
                      const cell = g.rows[r.key];
                      return (
                        <TableCell key={r.key} className="text-center">
                          <MasteryCell points={cell?.points} max={r.maxPoints} flagged={cell?.flagged} />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right text-base font-bold tabular-nums">
                      {g.total !== null ? `${g.total}/${rubric.maxPoints}` : <span className="font-normal text-muted-foreground">-</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {scoredRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="text-sm font-bold">Earned the point</TableCell>
                  <TableCell className="text-sm text-muted-foreground">of {pluralize(scoredRows.length, "scored essay")}</TableCell>
                  {rubric.rows.map((r) => (
                    <TableCell key={r.key} className="text-center">
                      <Pill tone="neutral" className="tabular-nums">
                        {earnedBy(r.key, r.maxPoints)} of {scoredRows.length}
                      </Pill>
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
          <MasteryLegend />
        </section>
      )}

      <p className="text-sm text-muted-foreground">Scores stay private until you approve them.</p>
    </PageBody>
  );
}
