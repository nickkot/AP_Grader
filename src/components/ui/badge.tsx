import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const dotVariants = cva("inline-block size-2 shrink-0 rounded-full", {
  variants: {
    tone: {
      ok: "bg-success",
      review: "bg-warning",
      error: "bg-critical",
      neutral: "bg-muted-foreground/60",
      progress: "bg-primary",
    },
  },
  defaultVariants: { tone: "neutral" },
});

type Tone = NonNullable<VariantProps<typeof dotVariants>["tone"]>;

function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn(dotVariants({ tone }), className)} />;
}

const pillVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold",
  {
    variants: {
      tone: {
        ok: "bg-success-soft text-success",
        review: "bg-warning-soft text-warning-text",
        error: "bg-critical-soft text-critical",
        neutral: "bg-surface-muted text-muted-foreground",
        progress: "bg-primary-soft text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** A status or count. Tinted, fully round, always with words. */
function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span data-slot="pill" className={cn(pillVariants({ tone }), className)}>
      {children}
    </span>
  );
}

/** Kept for existing screens: a pill with a leading dot. */
function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Pill tone={tone} className={className}>
      <StatusDot tone={tone} />
      {children}
    </Pill>
  );
}

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground", className)}
      {...props}
    />
  );
}

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 font-mono text-xs text-muted-foreground shadow-low",
        className,
      )}
      {...props}
    />
  );
}

export { Badge, Pill, StatusBadge, StatusDot, Kbd, type Tone };
