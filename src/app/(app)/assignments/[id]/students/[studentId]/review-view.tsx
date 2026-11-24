"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge, Kbd, Pill, StatusBadge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { MoreHorizontalIcon } from "lucide-react";
import { acceptRow, adjustRow, approveSubmission, editFeedback, rescore, unapproveSubmission } from "@/lib/actions/review";
import { findQuote } from "@/lib/ai/quotes";
import type { Evidence } from "@/lib/db/schema";
import type { Rubric } from "@/lib/rubrics";
import { cn } from "@/lib/utils";
import type { PageView } from "@/app/(app)/assignments/[id]/students/[studentId]/verify-view";

type Row = {
  id: string;
  rowKey: string;
  maxPoints: number;
  points: number | null;
  aiPoints: number | null;
  justification: string;
  studentFeedback: string;
  confidence: number | null;
  evidence: Evidence[];
  flags: string[];
  reviewStatus: "pending" | "accepted" | "adjusted";
  error: string | null;
};

const FLAG_LABEL: Record<string, string> = {
  low_confidence: "Low confidence",
  borderline: "Close call",
  unverified_evidence: "Quote not found",
  feedback_check: "Check comment",
  failed: "Not scored",
};

function Highlighted({ text, quotes, activeQuote }: { text: string; quotes: string[]; activeQuote: string | null }) {
  const ranges = quotes
    .map((q) => ({ q, r: findQuote(text, q) }))
    .filter((x): x is { q: string; r: { start: number; end: number } } => x.r !== null)
    .sort((a, b) => a.r.start - b.r.start);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const { q, r } of ranges) {
    if (r.start < pos) continue;
    out.push(<Fragment key={`t${pos}`}>{text.slice(pos, r.start)}</Fragment>);
    out.push(
      <mark
        key={`m${r.start}`}
        data-quote={q}
        className={cn("rounded-sm px-0.5 text-foreground", q === activeQuote ? "bg-highlight-strong" : "bg-highlight")}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    pos = r.end;
  }
  out.push(<Fragment key="end">{text.slice(pos)}</Fragment>);
  return <>{out}</>;
}

function EssayText({ paragraphs, quotes, activeQuote }: { paragraphs: string; quotes: string[]; activeQuote: string | null }) {
  return (
    <div className="essay-text whitespace-pre-wrap">
      <Highlighted text={paragraphs} quotes={quotes} activeQuote={activeQuote} />
    </div>
  );
}

export function ReviewView({
  submission,
  rubric,
  rows,
  pages,
  nextReviewHref,
  prevHref,
  nextHref,
  backHref,
}: {
  submission: { id: string; status: string; inputKind: "handwritten" | "typed"; typedText: string };
  rubric: Rubric;
  rows: Row[];
  pages: PageView[];
  nextReviewHref: string | null;
  prevHref: string | null;
  nextHref: string | null;
  backHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const approved = submission.status === "approved";
  const ordered = useMemo(
    () => rubric.rows.map((r) => ({ def: r, row: rows.find((x) => x.rowKey === r.key) })).filter((x) => x.row) as { def: Rubric["rows"][number]; row: Row }[],
    [rubric, rows],
  );
  const firstFlagged = ordered.findIndex((x) => x.row.flags.length > 0 && x.row.reviewStatus === "pending");
  const [active, setActive] = useState(Math.max(0, firstFlagged));
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [tab, setTab] = useState("essay");
  const essayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  // Bring the active row into view inside the score panel only, so a flagged row
  // further down is not missed and the page itself never jumps.
  useEffect(() => {
    const panel = asideRef.current;
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!panel || !el || panel.scrollHeight <= panel.clientHeight) return;
    const p = panel.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const header = 72;
    if (r.top < p.top + header) panel.scrollTop -= p.top + header - r.top;
    else if (r.bottom > p.bottom) panel.scrollTop += r.bottom - p.bottom + 8;
  }, [active]);

  const total = ordered.reduce((s, x) => s + (x.row.points ?? 0), 0);
  const activeRow = ordered[active]?.row;
  const activeQuotes = activeRow?.evidence.map((e) => e.quote) ?? [];

  const run = useCallback(
    (fn: () => Promise<unknown>, after?: () => void) =>
      start(async () => {
        const res = (await fn()) as { error?: string } | undefined;
        if (res && typeof res === "object" && "error" in res && res.error) toast.error(res.error);
        else after?.();
        router.refresh();
      }),
    [router],
  );

  const approve = useCallback(() => {
    if (approved) return;
    run(
      () => approveSubmission(submission.id),
      () => {
        toast.success("Approved");
        if (nextReviewHref) router.push(nextReviewHref);
      },
    );
  }, [approved, nextReviewHref, router, run, submission.id]);

  const setPoints = useCallback(
    (row: Row, points: number) => {
      if (approved) return;
      run(() => (points === row.points && row.reviewStatus === "pending" ? acceptRow(row.id) : adjustRow(row.id, points)));
    },
    [approved, run],
  );

  function showQuote(e: Evidence) {
    setActiveQuote(e.quote);
    setTab("essay");
    requestAnimationFrame(() => {
      const el = essayRef.current?.querySelector(`mark[data-quote="${CSS.escape(e.quote)}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("textarea, input, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        approve();
      } else if (key === "j" && nextHref) router.push(nextHref);
      else if (key === "k" && prevHref) router.push(prevHref);
      else if (key === "n" && nextReviewHref) router.push(nextReviewHref);
      else if (key === "arrowdown") {
        e.preventDefault();
        setActive((i) => Math.min(ordered.length - 1, i + 1));
      } else if (key === "arrowup") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (/^[0-9]$/.test(key) && activeRow) {
        const p = Number(key);
        if (p <= activeRow.maxPoints) setPoints(activeRow, p);
      } else if (key === "enter" && activeRow) {
        e.preventDefault();
        if (activeRow.points !== null) setPoints(activeRow, activeRow.points);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approve, activeRow, nextHref, nextReviewHref, ordered.length, prevHref, router, setPoints]);

  const essayBody =
    submission.inputKind === "typed" ? (
      <EssayText paragraphs={submission.typedText} quotes={activeQuotes} activeQuote={activeQuote} />
    ) : (
      <div className="flex flex-col gap-6">
        {pages
          .filter((p) => p.status === "transcribed")
          .map((p) => (
            <section key={p.id} aria-label={`Page ${p.pageNumber}`}>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">Page {p.pageNumber}</h3>
              <EssayText paragraphs={p.text} quotes={activeQuotes} activeQuote={activeQuote} />
            </section>
          ))}
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
      {/* Essay */}
      <div ref={essayRef} className="order-2 min-w-0 rounded-card border border-border bg-surface p-4 shadow-low sm:p-6 lg:order-1">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="essay">{submission.inputKind === "typed" ? "Essay" : "Transcription"}</TabsTrigger>
            {submission.inputKind === "handwritten" && <TabsTrigger value="pages">Page photos</TabsTrigger>}
          </TabsList>
          <TabsContent value="essay" className="max-w-[720px] pt-4">
            {essayBody}
          </TabsContent>
          <TabsContent value="pages" className="flex max-w-[720px] flex-col gap-4 pt-4">
            {pages.map((p) => (
              <figure key={p.id} className="flex flex-col gap-1">
                <figcaption className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Page {p.pageNumber}</figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photoUrl} alt={`Photo of page ${p.pageNumber}`} className="w-full rounded-panel border border-border" />
              </figure>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Scores */}
      <aside
        ref={asideRef}
        className="order-1 flex flex-col gap-3 lg:sticky lg:top-6 lg:order-2 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-canvas pb-2">
          <p className="text-2xl font-bold tabular-nums">
            {total}
            <span className="text-lg text-muted-foreground"> of {rubric.maxPoints}</span>
          </p>
          {approved ? <StatusBadge tone="ok">Approved</StatusBadge> : <StatusBadge tone="review">Not approved</StatusBadge>}
          <div className="ml-auto flex items-center gap-2">
            {approved ? (
              <Button variant="outline" onClick={() => run(() => unapproveSubmission(submission.id))} disabled={pending}>
                Unapprove
              </Button>
            ) : (
              <Button onClick={approve} disabled={pending}>
                Approve
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={() => {
                    if (window.confirm("Score this essay again? Your changes to its scores and comments will be replaced.")) {
                      run(() => rescore(submission.id));
                    }
                  }}
                >
                  Score again
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={backHref}>Back to the class</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ol ref={listRef} className="flex flex-col gap-3">
          {ordered.map(({ def, row }, i) => {
            const isActive = i === active;
            const flags = row.reviewStatus === "pending" ? row.flags : [];
            return (
              <li
                key={row.id}
                className={cn(
                  "flex flex-col gap-3 rounded-card border bg-surface p-4 shadow-low transition-colors duration-100",
                  isActive ? "border-primary" : "border-border",
                )}
                onClick={() => setActive(i)}
                aria-current={isActive ? "true" : undefined}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold">{def.label}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {row.points !== null && (
                        <Pill tone={row.points >= def.maxPoints ? "ok" : row.points > 0 ? "progress" : "neutral"}>
                          {def.maxPoints === 1 ? (row.points === 1 ? "Earned" : "Not earned") : `${row.points} of ${def.maxPoints}`}
                        </Pill>
                      )}
                      {flags.map((f) => (
                        <StatusBadge key={f} tone={f === "failed" ? "error" : "review"}>
                          {FLAG_LABEL[f] ?? f}
                        </StatusBadge>
                      ))}
                      {row.reviewStatus === "adjusted" && row.aiPoints !== null && <Badge>Changed from {row.aiPoints}</Badge>}
                      {row.reviewStatus === "accepted" && <Badge>Accepted</Badge>}
                    </div>
                  </div>
                  <div role="group" aria-label={`${def.label} points`} className="flex shrink-0 overflow-hidden rounded-control border border-input bg-surface">
                    {Array.from({ length: def.maxPoints + 1 }, (_, p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={approved || pending}
                        aria-pressed={row.points === p}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActive(i);
                          setPoints(row, p);
                        }}
                        className={cn(
                          "h-10 min-w-10 cursor-pointer border-l border-input px-2 text-base font-bold tabular-nums first:border-l-0 disabled:cursor-default",
                          row.points === p ? "bg-primary text-primary-foreground" : "bg-surface text-foreground hover:bg-primary-soft",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {row.error ? (
                  <p className="text-sm text-critical">{row.error}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{row.justification}</p>
                )}

                {row.evidence.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {row.evidence.map((e, j) => (
                      <li key={j}>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setActive(i);
                            showQuote(e);
                          }}
                          className="essay-text text-left text-[15px] leading-snug hover:underline"
                        >
                          &ldquo;{e.quote}&rdquo;
                        </button>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {e.verified ? (e.pageNumber ? `Page ${e.pageNumber}` : "") : "Not found in the essay"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-col gap-1">
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Comment for the student</p>
                  {editing === row.id ? (
                    <FeedbackEditor
                      initial={row.studentFeedback}
                      onCancel={() => setEditing(null)}
                      onSave={(text) => run(() => editFeedback(row.id, text), () => setEditing(null))}
                    />
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-base">{row.studentFeedback || <span className="text-muted-foreground">No comment</span>}</p>
                      {!approved && (
                        <Button
                          variant="tertiary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(row.id);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex">
          <span>
            <Kbd>A</Kbd> approve
          </span>
          <span>
            <Kbd>0</Kbd>-<Kbd>{Math.max(...rubric.rows.map((r) => r.maxPoints))}</Kbd> set points
          </span>
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> row
          </span>
          <span>
            <Kbd>N</Kbd> next to review
          </span>
          <span>
            <Kbd>J</Kbd> <Kbd>K</Kbd> next, previous
          </span>
        </div>

        {approved && nextReviewHref && (
          <Button asChild variant="outline">
            <Link href={nextReviewHref}>Next essay to review</Link>
          </Button>
        )}
        {!nextReviewHref && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <StatusDot tone="ok" /> No other essays need review.
          </p>
        )}
      </aside>
    </div>
  );
}

function FeedbackEditor({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus aria-label="Comment for the student" />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(text)}>
          Save comment
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
