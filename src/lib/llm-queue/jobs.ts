import "server-only";
import { and, asc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";

import { estimateCloudCost, type Usage } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { LLM_JOB_TYPES, llmJobs, llmWorkers, type LlmJobType } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs";
import { cloudModelFor, type LlmTask } from "@/lib/llm";

/**
 * The model job queue. Background jobs routed "local" wait for a worker on the teacher's
 * own computer, which claims them over HTTPS. Claims are atomic, carry a lease and a
 * fresh token, and a job nobody finishes by its deadline is run in the cloud.
 */

export type LlmJob = typeof llmJobs.$inferSelect;

const TASK_FOR: Record<LlmJobType, LlmTask> = { transcribe_page: "transcribe", score_row: "score_row" };
export const SERVER_WORKER = "server";

export function localModelFor(type: LlmJobType): string {
  const e = env();
  return type === "transcribe_page" ? e.LLM_LOCAL_MODEL_TRANSCRIBE : e.LLM_LOCAL_MODEL_SCORE;
}

function configuredRoute(type: LlmJobType): "local" | "cloud" {
  const e = env();
  return type === "transcribe_page" ? e.LLM_ROUTE_TRANSCRIBE : e.LLM_ROUTE_SCORE;
}

const seconds = (n: number) => n * 1000;

/** Record that a worker is alive and which models it has. */
export async function heartbeat(workerId: string, models: string[], version: string | null = null, now = new Date()) {
  await db
    .insert(llmWorkers)
    .values({ id: workerId, lastSeenAt: now, models, version })
    .onConflictDoUpdate({ target: llmWorkers.id, set: { lastSeenAt: now, models, version } });
}

/** True when a worker with this job type's model checked in recently. */
export async function workerOnline(type: LlmJobType, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - seconds(env().LLM_WORKER_STALE_SECONDS));
  const rows = await db
    .select({ id: llmWorkers.id })
    .from(llmWorkers)
    .where(and(gt(llmWorkers.lastSeenAt, since), sql`${llmWorkers.models} @> ${JSON.stringify([localModelFor(type)])}::jsonb`))
    .limit(1);
  return rows.length > 0;
}

/**
 * Where a new job should run right now: locally only when that route is on, a worker token
 * is set and a worker with the right model is online. Otherwise the cloud, with no waiting.
 */
export async function chooseRoute(type: LlmJobType, now = new Date()): Promise<"local" | "cloud"> {
  if (!env().LLM_WORKER_TOKEN || configuredRoute(type) !== "local") return "cloud";
  if (!(await workerOnline(type, now))) return "cloud";
  // A laptop takes minutes per job. Past a short queue, waiting for it costs teachers more time than it saves.
  const [{ waiting }] = await db
    .select({ waiting: sql<number>`count(*)`.mapWith(Number) })
    .from(llmJobs)
    .where(and(eq(llmJobs.route, "local"), inArray(llmJobs.status, ["pending", "claimed"])));
  return waiting < env().LLM_LOCAL_MAX_QUEUE ? "local" : "cloud";
}

/** Queue a job for a local worker and start the deadline watch. */
export async function enqueueLocalJob(type: LlmJobType, input: Record<string, unknown>, now = new Date()): Promise<LlmJob> {
  const [job] = await db
    .insert(llmJobs)
    .values({ type, route: "local", input, status: "pending", deadlineAt: new Date(now.getTime() + seconds(env().LLM_LOCAL_TIMEOUT_SECONDS)), createdAt: now })
    .returning();
  await enqueue({ name: "llm/job.watch", data: { jobId: job.id } });
  return job;
}

/** Queue a job for the cloud and run it now (in the background). */
export async function enqueueCloudJob(type: LlmJobType, input: Record<string, unknown>, now = new Date()): Promise<LlmJob> {
  const [job] = await db.insert(llmJobs).values({ type, route: "cloud", input, status: "pending", createdAt: now }).returning();
  await enqueue({ name: "llm/job.cloud", data: { jobId: job.id } });
  return job;
}

/** Queue a job wherever it should run right now. */
export async function enqueueJob(type: LlmJobType, input: Record<string, unknown>, now = new Date()): Promise<LlmJob> {
  return (await chooseRoute(type, now)) === "local" ? enqueueLocalJob(type, input, now) : enqueueCloudJob(type, input, now);
}

/** Job types a worker can take, given the models it has pulled. */
export function claimableTypes(models: string[]): LlmJobType[] {
  return LLM_JOB_TYPES.filter((t) => models.includes(localModelFor(t)));
}

/**
 * Atomically claim the oldest local job this worker can run. `FOR UPDATE SKIP LOCKED`
 * means two workers polling at the same moment never get the same job.
 * Jobs past their deadline are not handed out: the cloud takes those.
 */
export async function claimNextJob(workerId: string, models: string[], now = new Date()): Promise<LlmJob | null> {
  const types = claimableTypes(models);
  if (types.length === 0) return null;
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: llmJobs.id, type: llmJobs.type })
      .from(llmJobs)
      .where(and(eq(llmJobs.status, "pending"), eq(llmJobs.route, "local"), inArray(llmJobs.type, types), gt(llmJobs.deadlineAt, now)))
      .orderBy(asc(llmJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;
    const [job] = await tx
      .update(llmJobs)
      .set({
        status: "claimed",
        workerId,
        claimToken: sql`gen_random_uuid()`,
        claimedAt: now,
        leaseExpiresAt: new Date(now.getTime() + seconds(env().LLM_LEASE_SECONDS)),
        attempts: sql`${llmJobs.attempts} + 1`,
        model: localModelFor(candidate.type),
      })
      .where(eq(llmJobs.id, candidate.id))
      .returning();
    return job;
  });
}

const holds = (jobId: string, claimToken: string) => and(eq(llmJobs.id, jobId), eq(llmJobs.claimToken, claimToken), eq(llmJobs.status, "claimed"));

/** Keep a long local job from expiring. Also counts as a heartbeat. False when the claim was lost. */
export async function extendLease(jobId: string, claimToken: string, now = new Date()): Promise<boolean> {
  const rows = await db
    .update(llmJobs)
    .set({ leaseExpiresAt: new Date(now.getTime() + seconds(env().LLM_LEASE_SECONDS)) })
    .where(holds(jobId, claimToken))
    .returning({ workerId: llmJobs.workerId });
  if (rows[0]?.workerId) await db.update(llmWorkers).set({ lastSeenAt: now }).where(eq(llmWorkers.id, rows[0].workerId));
  return rows.length > 0;
}

/** Store a worker's answer. Null when the claim was lost (the cloud already took the job). */
export async function completeLocal(
  jobId: string,
  claimToken: string,
  result: { output: unknown; tokensIn: number; tokensOut: number; model: string },
  now = new Date(),
): Promise<LlmJob | null> {
  const [current] = await db.select({ type: llmJobs.type }).from(llmJobs).where(eq(llmJobs.id, jobId));
  if (!current) return null;
  const estimate = estimateCloudCost(cloudModelFor(TASK_FOR[current.type]), result.tokensIn, result.tokensOut);
  const [job] = await db
    .update(llmJobs)
    .set({
      status: "completed",
      provider: "local",
      output: result.output,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      model: result.model,
      costUsd: "0",
      cloudCostEstimateUsd: estimate.toFixed(6),
      completedAt: now,
      leaseExpiresAt: null,
      error: null,
    })
    .where(holds(jobId, claimToken))
    .returning();
  return job ?? null;
}

/** A worker could not run the job: hand it to the cloud right away. */
export async function failLocal(jobId: string, claimToken: string, error: string): Promise<boolean> {
  const rows = await db
    .update(llmJobs)
    .set({ route: "cloud", status: "pending", workerId: null, claimToken: null, leaseExpiresAt: null, error: error.slice(0, 500) })
    .where(holds(jobId, claimToken))
    .returning({ id: llmJobs.id });
  if (rows.length === 0) return false;
  await enqueue({ name: "llm/job.cloud", data: { jobId } });
  return true;
}

/** A worker is shutting down: put the job back for another worker (or the deadline). */
export async function releaseLocal(jobId: string, claimToken: string): Promise<boolean> {
  const rows = await db
    .update(llmJobs)
    .set({ status: "pending", workerId: null, claimToken: null, leaseExpiresAt: null })
    .where(holds(jobId, claimToken))
    .returning({ id: llmJobs.id });
  return rows.length > 0;
}

/** Claim a job for the server to run in the cloud: only if it is pending, or its local lease ran out. */
export async function claimForCloud(jobId: string, now = new Date()): Promise<LlmJob | null> {
  const [job] = await db
    .update(llmJobs)
    .set({
      status: "claimed",
      route: "cloud",
      workerId: SERVER_WORKER,
      claimToken: sql`gen_random_uuid()`,
      claimedAt: now,
      leaseExpiresAt: new Date(now.getTime() + seconds(env().LLM_LEASE_SECONDS)),
      attempts: sql`${llmJobs.attempts} + 1`,
    })
    .where(and(eq(llmJobs.id, jobId), or(eq(llmJobs.status, "pending"), and(eq(llmJobs.status, "claimed"), lt(llmJobs.leaseExpiresAt, now)))))
    .returning();
  return job ?? null;
}

function usageColumns(usage: Usage) {
  return {
    tokensIn: usage.inputTokens,
    tokensOut: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    costUsd: usage.costUsd.toFixed(6),
  };
}

export async function finishCloud(jobId: string, claimToken: string, result: { model: string; usage: Usage }, now = new Date()) {
  await db
    .update(llmJobs)
    .set({ status: "completed", provider: "cloud", model: result.model, ...usageColumns(result.usage), completedAt: now, leaseExpiresAt: null })
    .where(holds(jobId, claimToken));
}

export async function endJob(jobId: string, status: "failed" | "cancelled", error: string | null, now = new Date()) {
  await db.update(llmJobs).set({ status, error: error?.slice(0, 500) ?? null, completedAt: now, leaseExpiresAt: null }).where(eq(llmJobs.id, jobId));
}

/** Record a model call the server made directly (cloud route, live requests, retries). */
export async function recordCloudCall(
  type: LlmJobType,
  input: Record<string, unknown>,
  result: { model: string; usage: Usage } | { error: string },
  now = new Date(),
) {
  await db.insert(llmJobs).values({
    type,
    route: "cloud",
    input,
    provider: "cloud",
    createdAt: now,
    completedAt: now,
    workerId: SERVER_WORKER,
    ...("error" in result
      ? { status: "failed" as const, error: result.error.slice(0, 500) }
      : { status: "completed" as const, model: result.model, ...usageColumns(result.usage) }),
  });
}

export async function clearOutput(jobId: string) {
  await db.update(llmJobs).set({ output: null }).where(eq(llmJobs.id, jobId));
}

export async function getJob(jobId: string): Promise<LlmJob | null> {
  return (await db.query.llmJobs.findFirst({ where: eq(llmJobs.id, jobId) })) ?? null;
}
