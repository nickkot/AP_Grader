"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHint, Label, Textarea } from "@/components/ui/input";
import { extractEssayText } from "@/lib/actions/extract";
import { saveTypedEssayAndScore } from "@/lib/actions/review";

export function TypedEntry({
  assignmentId,
  studentId,
  uploadHref,
  initialText = "",
}: {
  assignmentId: string;
  studentId: string;
  uploadHref: string;
  initialText?: string;
}) {
  const [state, action, pending] = useActionState(saveTypedEssayAndScore, undefined);
  const [text, setText] = useState(initialText);
  const [fileError, setFileError] = useState<string | null>(null);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await extractEssayText(fd);
    if (res.error) setFileError(res.error);
    else setText(res.text ?? "");
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-low sm:p-6">
      <p className="text-base text-muted-foreground">
        No pages yet for this student.{" "}
        <Link href={uploadHref} className="text-primary underline underline-offset-2">
          Upload photos
        </Link>{" "}
        of handwritten pages, or add a typed essay below.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="studentId" value={studentId} />
        <Field>
          <Label htmlFor="text">Typed essay</Label>
          <Textarea id="text" name="text" rows={14} className="essay-text" value={text} onChange={(e) => setText(e.target.value)} />
          <FieldHint>{words} words</FieldHint>
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending || words < 5}>
            {pending ? "Sending to scoring" : "Score essay"}
          </Button>
          <Button asChild variant="outline">
            <label>
              Import .docx, .pdf or .txt
              <input type="file" accept=".docx,.pdf,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </Button>
        </div>
        {(state?.error || fileError) && <FieldError>{state?.error ?? fileError}</FieldError>}
      </form>
    </div>
  );
}
