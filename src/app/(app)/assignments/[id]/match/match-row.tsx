"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Label, NativeSelect } from "@/components/ui/input";
import { discardPage, matchPage } from "@/lib/actions/uploads";

export function MatchRow({
  assignmentId,
  page,
  students,
  maxPages,
}: {
  assignmentId: string;
  page: { id: string; url: string; originalUrl: string | null; reason: string | null; pageNumber: number | null; capturedAt: string };
  students: { id: string; name: string; sortName: string }[];
  maxPages: number;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-4 rounded-panel border border-border bg-surface p-4 sm:grid-cols-[240px_1fr]">
      <a href={page.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-control border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.url} alt="Unmatched page" className="aspect-[3/4] w-full object-cover object-top" />
      </a>
      <form action={(fd) => start(() => matchPage(assignmentId, fd))} className="flex flex-col gap-3">
        <input type="hidden" name="pageId" value={page.id} />
        {page.reason && <p className="text-sm text-muted-foreground">{page.reason}</p>}
        <Field>
          <Label htmlFor={`student-${page.id}`}>Student</Label>
          <NativeSelect id={`student-${page.id}`} name="studentId" required defaultValue="">
            <option value="" disabled>
              Pick a student
            </option>
            {students
              .slice()
              .sort((a, b) => a.sortName.localeCompare(b.sortName))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sortName}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field className="max-w-32">
          <Label htmlFor={`page-${page.id}`}>Page</Label>
          <NativeSelect id={`page-${page.id}`} name="pageNumber" defaultValue={String(page.pageNumber ?? 1)}>
            {Array.from({ length: Math.max(maxPages, page.pageNumber ?? 1) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Match page
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => start(() => discardPage(assignmentId, page.id))}>
            Discard
          </Button>
        </div>
      </form>
    </div>
  );
}
