import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { practiceHistory } from "@/lib/practice/attempts";
import { essayTypeLabel, scoreLabel } from "@/lib/practice/labels";
import { PRACTICE_PROMPTS } from "@/lib/practice/prompts";
import { totalMinutes } from "@/lib/practice/timing";
import { COURSES, ESSAY_TYPES, type Course } from "@/lib/rubrics";
import { requireStudent } from "@/lib/session";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage(props: PageProps<"/practice/library">) {
  const student = await requireStudent();
  const params = await props.searchParams;
  const course = typeof params.course === "string" && params.course in COURSES ? (params.course as Course) : "";
  const status = params.status === "new" || params.status === "done" ? params.status : "";
  const history = await practiceHistory(student.id);

  const best = new Map<string, string>();
  const started = new Set<string>();
  for (const h of history) {
    if (!h.prompt) continue;
    started.add(h.prompt.key);
    if (h.status === "scored" && h.total !== null) {
      const prev = best.get(h.prompt.key);
      const label = scoreLabel(h.total, h.maxTotal)!;
      if (!prev || Number(prev.split(" ")[0]) < h.total) best.set(h.prompt.key, label);
    }
  }

  const prompts = PRACTICE_PROMPTS.filter(
    (p) =>
      (!course || ESSAY_TYPES[p.essayType].course === course) &&
      (!status || (status === "done" ? best.has(p.key) : !started.has(p.key))),
  );

  return (
    <PageBody>
      <PageHeader title="Library" description={`${PRACTICE_PROMPTS.length} practice prompts. Pick one to read it and start.`} />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm font-bold">
          Course
          <NativeSelect name="course" defaultValue={course} className="w-56">
            <option value="">All courses</option>
            {Object.entries(COURSES).map(([key, c]) => (
              <option key={key} value={key}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Show
          <NativeSelect name="status" defaultValue={status} className="w-44">
            <option value="">All prompts</option>
            <option value="new">Not started</option>
            <option value="done">Scored</option>
          </NativeSelect>
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {prompts.length === 0 ? (
        <EmptyState>No prompts match these filters.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prompt</TableHead>
              <TableHead className="hidden w-56 md:table-cell">Unit</TableHead>
              <TableHead className="hidden w-28 sm:table-cell">Time</TableHead>
              <TableHead className="w-32 text-right">Your best</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map((p) => (
              <TableRow key={p.key}>
                <TableCell className="max-w-0">
                  <Link href={`/practice/prompts/${p.key}`} className="block truncate font-bold text-primary underline-offset-4 hover:underline">
                    {p.title}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {essayTypeLabel(p)}
                    {p.difficulty === "challenging" ? " · Challenging" : ""}
                  </span>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{p.unit}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{totalMinutes(p.essayType)} min</TableCell>
                <TableCell className="text-right text-sm">
                  {best.get(p.key) ?? (started.has(p.key) ? <span className="text-muted-foreground">Started</span> : "")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageBody>
  );
}
