import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageBody, PageHeader, SectionTitle } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banner, UpNext } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { startPractice } from "@/lib/actions/practice";
import { nextPrompt, practiceHistory, studentClasses, type HistoryItem } from "@/lib/practice/attempts";
import { essayTypeLabel, scoreLabel } from "@/lib/practice/labels";
import { totalMinutes } from "@/lib/practice/timing";
import { requireStudent } from "@/lib/session";

export const metadata: Metadata = { title: "Practice" };

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function Status({ item }: { item: HistoryItem }) {
  if (item.status === "scored") return <span className="font-bold tabular-nums">{scoreLabel(item.total, item.maxTotal)}</span>;
  if (item.status === "scoring") return <StatusBadge tone="progress">Scoring</StatusBadge>;
  if (item.status === "failed") return <StatusBadge tone="error">Not scored</StatusBadge>;
  return <StatusBadge tone="review">Writing</StatusBadge>;
}

export default async function PracticeHome() {
  const student = await requireStudent();
  const [history, classes] = await Promise.all([practiceHistory(student.id), studentClasses(student.id)]);
  const writing = history.find((h) => h.status === "writing");
  const next = nextPrompt(
    history,
    classes.map((c) => c.course),
  );

  return (
    <PageBody wide={false}>
      <PageHeader title="Practice" description="Write an AP essay, then see what earned points and what to fix next." />

      {writing?.prompt ? (
        <UpNext
          title="Finish your essay"
          reason={writing.prompt.title}
          action={
            <Button asChild>
              <Link href={`/practice/essays/${writing.id}`}>Keep writing</Link>
            </Button>
          }
        />
      ) : next ? (
        <UpNext
          title={next.title}
          reason={`${essayTypeLabel(next)} · ${totalMinutes(next.essayType)} minutes, timed`}
          action={
            <form action={startPractice}>
              <input type="hidden" name="promptKey" value={next.key} />
              <input type="hidden" name="mode" value="timed" />
              <Button type="submit">Start timed essay</Button>
            </form>
          }
        />
      ) : null}

      {classes.length > 0 && (
        <Banner tone="info">
          Your teacher can see the practice essays you write. {classes.length === 1 ? "Class" : "Classes"}: {classes.map((c) => c.name).join(", ")}.
        </Banner>
      )}

      <section className="flex flex-col gap-4">
        <SectionTitle
          action={
            <Link href="/practice/library" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
              All prompts
            </Link>
          }
        >
          Your essays
        </SectionTitle>
        {history.length === 0 ? (
          <EmptyState>No practice essays yet. Start the one above, or pick a prompt from the library.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prompt</TableHead>
                <TableHead className="hidden w-28 sm:table-cell">Started</TableHead>
                <TableHead className="w-28 text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="max-w-0">
                    <Link href={`/practice/essays/${h.id}`} className="block truncate font-bold text-primary underline-offset-4 hover:underline">
                      {h.prompt?.title ?? "Prompt removed"}
                    </Link>
                    <span className="text-sm text-muted-foreground">{h.mode === "timed" ? "Timed" : "Untimed"}</span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{DATE.format(h.startedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Status item={h} />
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
