import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  back,
  actions,
  actionsOnPhone = true,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** False when the page repeats the actions below its Up next card on phones (see PhoneActions). */
  actionsOnPhone?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline underline-offset-4"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1
          className="text-xl font-bold break-words sm:truncate sm:text-2xl"
          title={typeof title === "string" ? title : undefined}
        >
          {title}
        </h1>
        {description && <div className="mt-1 text-base text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className={cn("flex-wrap items-center gap-2", actionsOnPhone ? "flex" : "hidden sm:flex")}>{actions}</div>}
    </div>
  );
}

/** Secondary actions shown under the Up next card on phones, so the main action comes first. */
export function PhoneActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 sm:hidden">{children}</div>;
}

export function PageBody({ className, wide = true, ...props }: React.ComponentProps<"main"> & { wide?: boolean }) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8",
        wide ? "max-w-[1400px]" : "max-w-[760px]",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border border-dashed border-input bg-surface px-6 py-8">
      <p className="text-base text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}
