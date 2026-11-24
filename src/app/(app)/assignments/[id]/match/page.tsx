import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";

import { MatchRow } from "@/app/(app)/assignments/[id]/match/match-row";
import { EmptyState, PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { getAssignmentForTeacher, rosterFor, rosterLabel, studentName } from "@/lib/data";
import { presignDownload } from "@/lib/storage";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Match pages" };

export default async function MatchPage(props: PageProps<"/assignments/[id]/match">) {
  const teacher = await requireTeacher();
  const { id } = await props.params;
  const assignment = await getAssignmentForTeacher(id, teacher.id);
  const roster = await rosterFor(assignment.classId);
  const unmatched = await db.query.pages.findMany({
    where: and(eq(pages.assignmentId, assignment.id), eq(pages.status, "unmatched")),
    orderBy: asc(pages.createdAt),
  });
  const withUrls = await Promise.all(
    unmatched.map(async (p) => ({ ...p, url: await presignDownload(p.originalKey) })),
  );

  return (
    <PageBody>
      <PageHeader
        back={{ href: `/assignments/${assignment.id}`, label: assignment.title }}
        title="Match pages"
        description="Pick the student and page number for each photo. Spare sheets have the name written at the top."
      />
      {withUrls.length === 0 ? (
        <EmptyState
          action={
            <Button asChild variant="outline">
              <Link href={`/assignments/${assignment.id}`}>Back to the class</Link>
            </Button>
          }
        >
          Every page is matched.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {withUrls.map((p) => (
            <MatchRow
              key={p.id}
              assignmentId={assignment.id}
              page={{ id: p.id, url: p.url, originalUrl: null, reason: p.error, pageNumber: p.pageNumber, capturedAt: p.capturedAt.toISOString() }}
              students={roster.map((s) => ({ id: s.id, name: studentName(s), sortName: rosterLabel(s) }))}
              maxPages={assignment.answerPagesPerStudent}
            />
          ))}
        </div>
      )}
    </PageBody>
  );
}
