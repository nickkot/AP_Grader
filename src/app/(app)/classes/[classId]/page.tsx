import type { Metadata } from "next";
import Link from "next/link";

import { AddStudentsDialog } from "@/app/(app)/classes/[classId]/add-students-dialog";
import { EmptyState, PageBody, PageHeader, SectionTitle } from "@/components/page-header";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkCard, StatTile, UpNext } from "@/components/ui/card";
import { ProgressLegend, SegmentedProgress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClassForTeacher, rosterFor, studentName } from "@/lib/data";
import { assignmentsForClass, countsByAssignment, segmentsFor } from "@/lib/progress";
import { COURSES, ESSAY_TYPES } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage(props: PageProps<"/classes/[classId]">) {
  const teacher = await requireTeacher();
  const { classId } = await props.params;
  const cls = await getClassForTeacher(classId, teacher.id);
  const roster = await rosterFor(cls.id);
  const list = await assignmentsForClass(cls.id);
  const counts = await countsByAssignment(list.map((a) => a.id));

  const totalApproved = [...counts.values()].reduce((s, c) => s + c.approved, 0);
  const totalReview = [...counts.values()].reduce((s, c) => s + c.review, 0);
  const needsReview = list.find((a) => (counts.get(a.id)?.review ?? 0) > 0);

  let upNext: React.ReactNode;
  if (roster.length === 0) {
    upNext = (
      <UpNext
        title="Add your roster"
        reason="Answer sheets are printed with each student's name, so the class needs students first."
        action={<AddStudentsDialog classId={cls.id} primary />}
      />
    );
  } else if (list.length === 0) {
    upNext = (
      <UpNext
        title="Create the first assignment"
        reason="Pick the essay type, write the prompt and add the documents. Then print the packet."
        action={
          <Button asChild>
            <Link href={`/assignments/new?classId=${cls.id}`}>Create assignment</Link>
          </Button>
        }
      />
    );
  } else if (needsReview) {
    const n = counts.get(needsReview.id)!.review;
    upNext = (
      <UpNext
        title={`Review ${pluralize(n, "essay")}`}
        reason={needsReview.title}
        action={
          <Button asChild>
            <Link href={`/assignments/${needsReview.id}`}>Open assignment</Link>
          </Button>
        }
      />
    );
  } else {
    upNext = (
      <UpNext
        title="Create the next assignment"
        reason="Every scored essay in this class is approved."
        action={
          <Button asChild>
            <Link href={`/assignments/new?classId=${cls.id}`}>Create assignment</Link>
          </Button>
        }
      />
    );
  }

  const showCreateSecondary = roster.length > 0 && list.length > 0 && Boolean(needsReview);

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/classes", label: "Classes" }}
        title={cls.name}
        description={COURSES[cls.course].label}
        actions={
          showCreateSecondary ? (
            <Button asChild variant="outline">
              <Link href={`/assignments/new?classId=${cls.id}`}>Create assignment</Link>
            </Button>
          ) : undefined
        }
      />

      {upNext}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile value={roster.length} label="Students" />
        <StatTile value={list.length} label="Assignments" />
        <StatTile value={totalReview} label="Essays to review" />
        <StatTile value={totalApproved} label="Essays approved" />
      </div>

      <section className="flex flex-col gap-4">
        <SectionTitle>Assignments</SectionTitle>
        {list.length === 0 ? (
          <EmptyState>No assignments yet. Create one to print answer sheets for this class.</EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {list.map((a) => {
              const c = counts.get(a.id)!;
              const segments = segmentsFor(c);
              return (
                <LinkCard key={a.id} href={`/assignments/${a.id}`} className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold" title={a.title}>
                        {a.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{ESSAY_TYPES[a.essayType].label}</p>
                    </div>
                    {c.review > 0 && <Pill tone="review">{c.review} to review</Pill>}
                  </div>
                  <SegmentedProgress label="Essays" segments={segments} total={roster.length} />
                  <ProgressLegend segments={segments.filter((s) => s.value > 0 || s.tone === "done")} />
                </LinkCard>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle action={roster.length > 0 ? <AddStudentsDialog classId={cls.id} /> : undefined}>
          Roster
        </SectionTitle>
        {roster.length === 0 ? (
          <EmptyState>No students yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ({roster.length})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-0 truncate text-base" title={studentName(s)}>
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
