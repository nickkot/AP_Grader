import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs";
import { HANDLERS } from "@/lib/llm-queue/handlers";
import {
  claimNextJob,
  completeLocal,
  endJob,
  extendLease,
  failLocal,
  getJob,
  heartbeat,
  releaseLocal,
} from "@/lib/llm-queue/jobs";
import type { WireRequest } from "@/lib/llm/types";

/**
 * The HTTPS API the local worker calls. The worker connects out to the site; nothing on
 * the teacher's computer listens for connections. It authenticates with LLM_WORKER_TOKEN
 * and never sees database credentials.
 */

/** Constant-time check of the worker's bearer token. No token configured means no access. */
export function workerAuthorized(req: Request): boolean {
  const token = env().LLM_WORKER_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

const ClaimBody = z.object({
  workerId: z.string().trim().min(1).max(100),
  models: z.array(z.string().max(200)).max(100),
  version: z.string().max(50).optional(),
});

export type ClaimedJob = { id: string; type: string; claimToken: string; leaseSeconds: number; request: WireRequest };

export async function handleClaim(body: unknown): Promise<{ job: ClaimedJob | null }> {
  const { workerId, models, version } = ClaimBody.parse(body);
  await heartbeat(workerId, models, version ?? null);
  for (let i = 0; i < 5; i++) {
    const job = await claimNextJob(workerId, models);
    if (!job || !job.claimToken) return { job: null };
    let request: WireRequest | null;
    try {
      request = await HANDLERS[job.type].buildRequest(job);
    } catch (err) {
      await failLocal(job.id, job.claimToken, `Could not build the request: ${String(err)}`);
      continue;
    }
    if (!request) {
      await endJob(job.id, "cancelled", "No longer needed.");
      continue;
    }
    return { job: { id: job.id, type: job.type, claimToken: job.claimToken, leaseSeconds: env().LLM_LEASE_SECONDS, request } };
  }
  return { job: null };
}

const Token = z.object({ claimToken: z.string().uuid() });
const CompleteBody = Token.extend({
  json: z.unknown(),
  tokensIn: z.number().int().min(0).max(10_000_000),
  tokensOut: z.number().int().min(0).max(10_000_000),
  model: z.string().min(1).max(200),
});
const FailBody = Token.extend({ error: z.string().max(2000).default("Worker error.") });

export type ActionResult = { status: number; body: Record<string, unknown> };
const lost: ActionResult = { status: 409, body: { error: "This job is no longer yours. Drop it." } };

export async function handleJobAction(jobId: string, action: string, body: unknown): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(jobId).success) return { status: 404, body: { error: "Not found." } };
  switch (action) {
    case "complete": {
      const data = CompleteBody.parse(body);
      const job = await getJob(jobId);
      if (!job || job.status !== "claimed" || job.claimToken !== data.claimToken) return lost;
      try {
        HANDLERS[job.type].validate(data.json);
      } catch {
        // A malformed answer is never saved: the cloud does the job instead.
        await failLocal(jobId, data.claimToken, "The local answer did not match the expected format.");
        return { status: 422, body: { error: "The answer did not match the schema. The job went to the cloud." } };
      }
      const done = await completeLocal(jobId, data.claimToken, { output: data.json, tokensIn: data.tokensIn, tokensOut: data.tokensOut, model: data.model });
      if (!done) return lost;
      await enqueue({ name: "llm/job.apply", data: { jobId } });
      return { status: 200, body: { ok: true } };
    }
    case "fail": {
      const data = FailBody.parse(body);
      return (await failLocal(jobId, data.claimToken, data.error)) ? { status: 200, body: { ok: true } } : lost;
    }
    case "release": {
      const data = Token.parse(body);
      return (await releaseLocal(jobId, data.claimToken)) ? { status: 200, body: { ok: true } } : lost;
    }
    case "extend": {
      const data = Token.parse(body);
      return (await extendLease(jobId, data.claimToken)) ? { status: 200, body: { ok: true } } : lost;
    }
    default:
      return { status: 404, body: { error: "Not found." } };
  }
}
