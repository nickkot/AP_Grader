import * as React from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Segmented progress bar                                              */
/* ------------------------------------------------------------------ */

export type Segment = { value: number; tone: "done" | "review" | "working" | "error"; label: string };

const SEGMENT_COLOR: Record<Segment["tone"], string> = {
  done: "bg-success",
  review: "bg-warning",
  working: "bg-primary",
  error: "bg-critical",
};

/** Progress across a class. Always pair it with counts in words. */
export function SegmentedProgress({
  segments,
  total,
  className,
  label,
}: {
  segments: Segment[];
  total: number;
  className?: string;
  label: string;
}) {
  const shown = segments.filter((s) => s.value > 0);
  const summary = shown.map((s) => `${s.value} ${s.label}`).join(", ");
  return (
    <div
      role="img"
      aria-label={`${label}: ${summary || "nothing yet"} of ${total}`}
      className={cn("flex h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)}
    >
      {total > 0 &&
        shown.map((s) => (
          <span key={s.label} className={cn("h-full", SEGMENT_COLOR[s.tone])} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
    </div>
  );
}

export function ProgressLegend({ segments, className }: { segments: Segment[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground", className)}>
      {segments.map((s) => (
        <li key={s.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-full", SEGMENT_COLOR[s.tone])} />
          <span className="font-bold text-foreground tabular-nums">{s.value}</span> {s.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Mastery cells for rubric outcomes                                   */
/* ------------------------------------------------------------------ */

export type CellState = "full" | "partial" | "none" | "unscored";

export function cellState(points: number | null | undefined, max: number): CellState {
  if (points === null || points === undefined) return "unscored";
  if (points >= max) return "full";
  if (points > 0) return "partial";
  return "none";
}

const CELL: Record<CellState, string> = {
  full: "bg-progress-full text-progress-full-text",
  partial: "bg-progress-partial text-progress-partial-text",
  none: "bg-not-earned text-not-earned-text",
  unscored: "border border-border bg-canvas text-muted-foreground",
};

const CELL_LABEL: Record<CellState, string> = {
  full: "Earned",
  partial: "Partly earned",
  none: "Not earned",
  unscored: "Not scored yet",
};

/** One rubric row for one student. Shows points as text; color is never the only signal. */
export function MasteryCell({
  points,
  max,
  flagged = false,
  className,
}: {
  points: number | null | undefined;
  max: number;
  flagged?: boolean;
  className?: string;
}) {
  const state = cellState(points, max);
  const text = state === "unscored" ? "-" : String(points);
  const title = `${CELL_LABEL[state]}${state === "unscored" ? "" : `, ${points} of ${max}`}${flagged ? ". Needs review" : ""}`;
  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-cell text-sm font-bold tabular-nums",
        CELL[state],
        flagged && "ring-2 ring-warning ring-offset-2 ring-offset-surface",
        className,
      )}
    >
      {text}
    </span>
  );
}

export function MasteryLegend({ className }: { className?: string }) {
  const items: { node: React.ReactNode; label: string }[] = [
    { node: <MasteryCell points={1} max={1} className="size-5 text-[10px]" />, label: "Earned" },
    { node: <MasteryCell points={1} max={2} className="size-5 text-[10px]" />, label: "Partly earned" },
    { node: <MasteryCell points={0} max={1} className="size-5 text-[10px]" />, label: "Not earned" },
    { node: <MasteryCell points={null} max={1} className="size-5 text-[10px]" />, label: "Not scored yet" },
    { node: <MasteryCell points={1} max={1} flagged className="size-5 text-[10px]" />, label: "Needs review" },
  ];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground", className)} aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2" aria-hidden={false}>
          <span aria-hidden>{i.node}</span>
          {i.label}
        </li>
      ))}
    </ul>
  );
}
