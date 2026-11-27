import "server-only";

import { HANDLERS } from "@/lib/llm-queue/handlers";
import { claimForCloud, clearOutput, endJob, finishCloud, getJob } from "@/lib/llm-queue/jobs";

/**
 * What happens to a queued job after it is queued: the deadline watch, the cloud fallback,
 * and applying a local worker's answer.
 */

export type WatchResult = { done: true } | { done: false; waitUntil: Date };

/** Run a job in the cloud, unless it already finished or a worker still holds a live lease. */
export async function runJobInCloud(jobId: string, now = new Date()): Promise<void> {
  const job = await claimForCloud(jobId, now);
  if (!job || !job.claimToken) return;
  try {
    const result = await HANDLERS[job.type].runCloud(job);
    if (!result) return endJob(job.id, "cancelled", "No longer needed.");
    await finishCloud(job.id, job.claimToken, result);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "cloud fallback failed", jobId, err: String(err) }));
    await endJob(job.id, "failed", String(err));
  }
}

/**
 * Check a local job. Past its deadline while unclaimed, or past its lease while claimed,
 * it runs in the cloud now. Otherwise the watch comes back at the next moment that matters.
 */
export async function checkLlmJob(jobId: string, now = new Date()): Promise<WatchResult> {
  const job = await getJob(jobId);
  if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") return { done: true };
  if (job.status === "pending") {
    if (job.route === "cloud" || !job.deadlineAt || job.deadlineAt <= now) {
      await runJobInCloud(job.id, now);
      return { done: true };
    }
    return { done: false, waitUntil: job.deadlineAt };
  }
  if (job.leaseExpiresAt && job.leaseExpiresAt <= now) {
    await runJobInCloud(job.id, now);
    return { done: true };
  }
  return { done: false, waitUntil: new Date((job.leaseExpiresAt ?? now).getTime() + 1000) };
}

/** Use a completed local answer: save the transcription or row score, then drop the queue's copy of it. */
export async function applyLocalResult(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job || job.status !== "completed" || job.provider !== "local" || job.output === null) return;
  await HANDLERS[job.type].applyLocal(job);
  // The answer now lives on the page or row score. Student work does not stay in the queue table.
  await clearOutput(job.id);
}
