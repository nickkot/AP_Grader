import "server-only";
import { desc, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { llmJobs, llmWorkers } from "@/lib/db/schema";
import { env } from "@/lib/env";

/**
 * What model calls cost, month by month. A local job stores what the same tokens would
 * have cost at the cloud model's list price (no caching discount), so "saved" is an
 * estimate. Electricity is not counted.
 */

export type MonthlySavings = {
  month: string; // YYYY-MM
  localJobs: number;
  cloudJobs: number;
  localTokensIn: number;
  localTokensOut: number;
  cloudSpendUsd: number;
  savedUsd: number;
};

export async function monthlySavings(months = 12): Promise<MonthlySavings[]> {
  const local = sql`${llmJobs.provider} = 'local'`;
  const cloud = sql`${llmJobs.provider} = 'cloud'`;
  const month = sql<string>`to_char(date_trunc('month', ${llmJobs.completedAt} at time zone 'UTC'), 'YYYY-MM')`;
  const rows = await db
    .select({
      month,
      localJobs: sql<number>`count(*) filter (where ${local})`.mapWith(Number),
      cloudJobs: sql<number>`count(*) filter (where ${cloud})`.mapWith(Number),
      localTokensIn: sql<number>`coalesce(sum(${llmJobs.tokensIn}) filter (where ${local}), 0)`.mapWith(Number),
      localTokensOut: sql<number>`coalesce(sum(${llmJobs.tokensOut}) filter (where ${local}), 0)`.mapWith(Number),
      cloudSpendUsd: sql<number>`coalesce(sum(${llmJobs.costUsd}) filter (where ${cloud}), 0)`.mapWith(Number),
      savedUsd: sql<number>`coalesce(sum(${llmJobs.cloudCostEstimateUsd}) filter (where ${local}), 0)`.mapWith(Number),
    })
    .from(llmJobs)
    .where(sql`${llmJobs.status} = 'completed' and ${llmJobs.completedAt} is not null`)
    .groupBy(month)
    .orderBy(desc(month))
    .limit(months);
  return rows;
}

/** Jobs that are waiting or running right now, by where they run. */
export async function queueNow(): Promise<{ route: string; status: string; n: number }[]> {
  return db
    .select({ route: llmJobs.route, status: llmJobs.status, n: sql<number>`count(*)`.mapWith(Number) })
    .from(llmJobs)
    .where(sql`${llmJobs.status} in ('pending', 'claimed')`)
    .groupBy(llmJobs.route, llmJobs.status);
}

/** Workers seen recently, newest first, with whether each is online now. */
export async function workers() {
  const staleSeconds = env().LLM_WORKER_STALE_SECONDS;
  return db
    .select({
      id: llmWorkers.id,
      lastSeenAt: llmWorkers.lastSeenAt,
      models: llmWorkers.models,
      version: llmWorkers.version,
      online: sql<boolean>`${llmWorkers.lastSeenAt} > now() - make_interval(secs => ${staleSeconds})`,
    })
    .from(llmWorkers)
    .orderBy(desc(llmWorkers.lastSeenAt))
    .limit(20);
}
