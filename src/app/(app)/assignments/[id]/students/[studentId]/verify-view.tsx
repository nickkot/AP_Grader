"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusDot, Kbd } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Banner } from "@/components/ui/card";
import { confirmAndScore, savePageText } from "@/lib/actions/review";
import type { TranscriptLine } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export type PageView = {
  id: string;
  pageNumber: number;
  status: string;
  error: string | null;
  photoUrl: string;
  transcript: TranscriptLine[];
  text: string;
  edited: boolean;
  lowConfidenceCount: number;
};

const LOW = 0.75;

/** Transcript with low-confidence words highlighted, crossed-out words struck through and illegible words marked. */
export function TranscriptLines({ lines }: { lines: TranscriptLine[] }) {
  return (
    <div className="essay-text">
      {lines.map((line, i) => (
        <p key={i} className="min-h-[1.6em]">
          {line.words.map((w, j) => {
            const space = j > 0 ? " " : "";
            if (w.deleted)
              return (
                <span key={j}>
                  {space}
                  <span className="text-muted-foreground line-through" title="Crossed out. Not scored.">
                    {w.text}
                  </span>
                </span>
              );
            if (w.illegible)
              return (
                <span key={j}>
                  {space}
                  <span className="rounded bg-status-review-soft px-1 text-sm text-status-review-text" title="Could not be read">
                    illegible
                  </span>
                </span>
              );
            const low = w.confidence < LOW;
            return (
              <span key={j}>
                {space}
                <span
                  className={cn(low && "rounded-sm bg-status-review-soft underline decoration-status-review decoration-2 underline-offset-4")}
                  title={low ? "Check this word" : undefined}
                >
                  {w.text}
                </span>
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function PageEditor({ page }: { page: PageView }) {
  const [editing, setEditing] = useState(page.edited);
  const [text, setText] = useState(page.text);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await savePageText(page.id, text);
      if ("error" in res) setError(res.error ?? null);
      else {
        setSaved(true);
        setError(null);
      }
    });
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label={`Page ${page.pageNumber}`}>
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Page {page.pageNumber}</h2>
        <a href={page.photoUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-card border border-border bg-surface-muted shadow-low">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.photoUrl} alt={`Photo of page ${page.pageNumber}`} className="w-full" />
        </a>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex min-h-8 items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {page.status === "failed" ? (
              <>
                <StatusDot tone="error" /> {page.error}
              </>
            ) : page.lowConfidenceCount > 0 ? (
              <>
                <StatusDot tone="review" /> {page.lowConfidenceCount === 1 ? "1 word" : `${page.lowConfidenceCount} words`} to check
              </>
            ) : (
              "No words flagged"
            )}
          </span>
          {page.status !== "failed" && !editing && (
            <Button variant="tertiary" size="sm" onClick={() => setEditing(true)}>
              Edit text
            </Button>
          )}
        </div>
        {page.status === "failed" ? null : editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              aria-label={`Transcription of page ${page.pageNumber}`}
              className="essay-text min-h-96"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSaved(false);
              }}
              onBlur={() => !saved && save()}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {pending ? "Saving" : saved ? "Saved" : "Not saved"}
              {error && <span className="text-status-error">{error}</span>}
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface p-4 shadow-low sm:p-6">
            <TranscriptLines lines={page.transcript} />
          </div>
        )}
      </div>
    </section>
  );
}

export function VerifyView({
  submissionId,
  pages,
  nextHref,
}: {
  submissionId: string;
  pages: PageView[];
  nextHref: string | null;
  prevHref: string | null;
  nextStudentHref: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const flagged = pages.reduce((n, p) => n + p.lowConfidenceCount, 0);

  function confirm() {
    start(async () => {
      await confirmAndScore(submissionId);
      if (nextHref) router.push(nextHref);
      else router.refresh();
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        confirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col gap-6">
      <Banner
        tone="info"
        action={
          <span className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
            </span>
            <Button onClick={confirm} disabled={pending}>
              {pending ? "Sending to scoring" : "Confirm and score"}
            </Button>
          </span>
        }
      >
        <p className="font-bold">Check the transcription against the photos.</p>
        <p className="text-sm">
          {flagged === 1 ? "1 word is highlighted to check." : flagged > 1 ? `${flagged} words are highlighted to check.` : "No words are flagged."} Spelling
          and grammar errors from transcription never count against the student.
        </p>
      </Banner>
      {pages.map((p) => (
        <PageEditor key={p.id} page={p} />
      ))}
    </div>
  );
}
