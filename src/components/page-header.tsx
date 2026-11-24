import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  back,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="size-3" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="text-xl font-semibold break-words sm:truncate" title={typeof title === "string" ? title : undefined}>
          {title}
        </h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ className, wide = true, ...props }: React.ComponentProps<"main"> & { wide?: boolean }) {
  return (
    <main
      className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-6", wide ? "max-w-[1400px]" : "max-w-[720px]", className)}
      {...props}
    />
  );
}

export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-border px-6 py-8">
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
