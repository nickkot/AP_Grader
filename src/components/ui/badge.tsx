import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const dotVariants = cva("inline-block size-2 shrink-0 rounded-full", {
  variants: {
    tone: {
      ok: "bg-status-ok",
      review: "bg-status-review",
      error: "bg-status-error",
      neutral: "bg-muted-foreground/50",
      progress: "bg-primary",
    },
  },
  defaultVariants: { tone: "neutral" },
});

type Tone = NonNullable<VariantProps<typeof dotVariants>["tone"]>;

function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn(dotVariants({ tone }), className)} />;
}

/** A status label with a small dot. Status colors never fill large areas. */
function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-control border border-border bg-surface px-2 py-0.5 text-xs text-foreground",
        className,
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-control border border-border bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-muted px-1 font-mono text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Badge, StatusBadge, StatusDot, Kbd, type Tone };
