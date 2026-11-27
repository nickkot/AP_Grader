import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState, PageBody, PageHeader, SectionTitle } from "@/components/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, StatTile } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { env } from "@/lib/env";
import { monthlySavings, queueNow, workers } from "@/lib/llm-queue/savings";
import { requireTeacher } from "@/lib/session";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Model costs" };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US");
const seen = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const monthName = (ym: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));

export default async function ModelCostsPage() {
  const teacher = await requireTeacher();
  const e = env();
  // Only the people who run the site see this page. Everyone else gets a plain 404.
  if (!e.ADMIN_EMAILS.includes(teacher.email.toLowerCase())) notFound();

  const [months, queue, workerRows] = await Promise.all([monthlySavings(), queueNow(), workers()]);
  const count = (route: string, status: string) => queue.find((q) => q.route === route && q.status === status)?.n ?? 0;
  const totals = months.reduce(
    (t, m) => ({ local: t.local + m.localJobs, cloud: t.cloud + m.cloudJobs, spend: t.spend + m.cloudSpendUsd, saved: t.saved + m.savedUsd }),
    { local: 0, cloud: 0, spend: 0, saved: 0 },
  );
  const thisMonth = months[0];
  const routeLabel = (route: "local" | "cloud") => (route === "local" && e.LLM_WORKER_TOKEN ? "Your computer, when a worker is online" : "Cloud");

  return (
    <PageBody>
      <PageHeader title="Model costs" description="Where model calls run, what they cost, and what running them on your own computer saved." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile value={usd.format(thisMonth?.savedUsd ?? 0)} label="Saved this month" />
        <StatTile value={usd.format(thisMonth?.cloudSpendUsd ?? 0)} label="Cloud spend this month" />
        <StatTile value={whole.format(count("local", "pending") + count("local", "claimed"))} label="Waiting for or on your computer" />
        <StatTile value={whole.format(count("cloud", "pending") + count("cloud", "claimed"))} label="Waiting for or running in the cloud" />
      </div>

      <section className="flex flex-col gap-4">
        <SectionTitle>Workers</SectionTitle>
        {workerRows.length === 0 ? (
          <EmptyState>No worker has checked in. Every job runs in the cloud until one does. The README explains how to start one.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Last seen</TableHead>
                <TableHead className="hidden sm:table-cell">Models</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workerRows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-bold break-all sm:break-normal">{w.id}</TableCell>
                  <TableCell>{w.online ? <StatusBadge tone="ok">Online</StatusBadge> : <StatusBadge tone="neutral">Offline</StatusBadge>}</TableCell>
                  <TableCell className="hidden whitespace-nowrap sm:table-cell">{seen.format(w.lastSeenAt)}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{w.models.length ? w.models.join(", ") : "None. Is Ollama running?"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>Where jobs run</SectionTitle>
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-bold">Reading pages</p>
              <p className="text-base">{routeLabel(e.LLM_ROUTE_TRANSCRIBE)}</p>
              <p className="text-sm text-muted-foreground">
                {e.LLM_ROUTE_TRANSCRIBE === "local" && <>Model <span className="whitespace-nowrap">{e.LLM_LOCAL_MODEL_TRANSCRIBE}</span>. </>}
                Cloud model <span className="whitespace-nowrap">{e.TRANSCRIBE_MODEL}</span>.
              </p>
            </div>
            <div>
              <p className="text-sm font-bold">Scoring teacher essays</p>
              <p className="text-base">{routeLabel(e.LLM_ROUTE_SCORE)}</p>
              <p className="text-sm text-muted-foreground">
                {e.LLM_ROUTE_SCORE === "local" && <>Model <span className="whitespace-nowrap">{e.LLM_LOCAL_MODEL_SCORE}</span>. </>}
                Cloud model <span className="whitespace-nowrap">{e.SCORING_MODEL}</span>.
              </p>
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Student practice always runs in the cloud because students wait for it. A job your computer has not finished after{" "}
              {pluralize(Math.round(e.LLM_LOCAL_TIMEOUT_SECONDS / 60), "minute")} runs in the cloud. At most{" "}
              {pluralize(e.LLM_LOCAL_MAX_QUEUE, "job")} wait for your computer at once.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>By month</SectionTitle>
        {months.length === 0 ? (
          <EmptyState>No model calls yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="hidden text-right sm:table-cell">On your computer</TableHead>
                <TableHead className="hidden text-right md:table-cell">Tokens on your computer</TableHead>
                <TableHead className="hidden text-right sm:table-cell">In the cloud</TableHead>
                <TableHead className="text-right">Cloud spend</TableHead>
                <TableHead className="text-right">Saved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-bold whitespace-nowrap">{monthName(m.month)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{whole.format(m.localJobs)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{whole.format(m.localTokensIn + m.localTokensOut)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{whole.format(m.cloudJobs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd.format(m.cloudSpendUsd)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{usd.format(m.savedUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{whole.format(totals.local)}</TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{whole.format(totals.cloud)}</TableCell>
                <TableCell className="text-right tabular-nums">{usd.format(totals.spend)}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{usd.format(totals.saved)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
        <p className="text-sm text-muted-foreground">
          Saved is what the tokens your computer ran would have cost at the cloud model&apos;s list price. Electricity is not counted.
        </p>
      </section>
    </PageBody>
  );
}
