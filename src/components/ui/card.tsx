import * as React from "react";
import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, XCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="card" className={cn("rounded-card border border-border bg-surface shadow-low", className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 px-4 pt-4 sm:px-6 sm:pt-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-lg font-bold", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-4 sm:p-6", className)} {...props} />;
}

/** A card that is one link, for objects people open (a class, an assignment). */
function LinkCard({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-card border border-border bg-surface p-4 shadow-low transition-colors duration-100 hover:border-primary sm:p-6",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Up next: the one thing to do now                                    */
/* ------------------------------------------------------------------ */

function UpNext({
  title,
  reason,
  action,
  className,
}: {
  title: React.ReactNode;
  reason?: React.ReactNode;
  action: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="Up next"
      className={cn(
        "flex flex-col gap-4 rounded-card border border-primary-soft-border bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-primary uppercase">Up next</p>
        <p className="mt-1 text-lg font-bold">{title}</p>
        {reason && <p className="mt-1 text-sm text-muted-foreground">{reason}</p>}
      </div>
      <div className="shrink-0">{action}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Banner                                                              */
/* ------------------------------------------------------------------ */

type BannerTone = "info" | "success" | "warning" | "critical";

const BANNER: Record<BannerTone, { box: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }> = {
  info: { box: "bg-primary-soft border-l-primary", icon: InfoIcon, iconColor: "text-primary" },
  success: { box: "bg-success-soft border-l-success", icon: CheckCircle2Icon, iconColor: "text-success" },
  warning: { box: "bg-warning-soft border-l-warning", icon: AlertTriangleIcon, iconColor: "text-warning-text" },
  critical: { box: "bg-critical-soft border-l-critical", icon: XCircleIcon, iconColor: "text-critical" },
};

function Banner({
  tone,
  children,
  action,
  className,
}: {
  tone: BannerTone;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const b = BANNER[tone];
  const Icon = b.icon;
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-control border border-border border-l-4 px-4 py-3 text-base",
        b.box,
        className,
      )}
    >
      <Icon className={cn("size-5 shrink-0", b.iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */

function StatTile({ value, label, className }: { value: React.ReactNode; label: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card border border-border bg-surface px-4 py-3 shadow-low", className)}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, LinkCard, UpNext, Banner, StatTile };
