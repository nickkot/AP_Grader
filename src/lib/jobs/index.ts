import "server-only";

import { env } from "@/lib/env";
import type { JobEvent } from "@/lib/jobs/events";
import { inngest } from "@/lib/jobs/inngest-client";

export type { JobEvent } from "@/lib/jobs/events";

/**
 * Queue background work.
 *
 * - inngest: events go to Inngest, which calls /api/inngest with retries and
 *   per-function concurrency limits. Used in production.
 * - inline: jobs run in this process, a few at a time. Used for local
 *   development and tests. Jobs can enqueue more jobs.
 */
export async function enqueue(events: JobEvent | JobEvent[]): Promise<void> {
  const list = Array.isArray(events) ? events : [events];
  if (list.length === 0) return;
  if (env().JOBS_DRIVER === "inngest") {
    await inngest.send(list.map((e) => ({ name: e.name, data: e.data })));
    return;
  }
  for (const e of list) inline.push(e);
  pump();
}

/* ------------------------------------------------------------------ */
/* Inline driver                                                       */
/* ------------------------------------------------------------------ */

const INLINE_CONCURRENCY = 4;
const inline: JobEvent[] = [];
let running = 0;
let idleWaiters: (() => void)[] = [];

function pump() {
  while (running < INLINE_CONCURRENCY && inline.length > 0) {
    const event = inline.shift()!;
    running++;
    void (async () => {
      try {
        const { runJob } = await import("@/lib/jobs/run");
        await runJob(event);
      } catch (err) {
        console.error(JSON.stringify({ level: "error", msg: "inline job failed", job: event.name, err: String(err) }));
      } finally {
        running--;
        pump();
        if (running === 0 && inline.length === 0) {
          const waiters = idleWaiters;
          idleWaiters = [];
          waiters.forEach((w) => w());
        }
      }
    })();
  }
}

/** Resolves when every queued inline job (and the jobs they queued) has finished. For tests and scripts. */
export function drainInlineJobs(): Promise<void> {
  if (running === 0 && inline.length === 0) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.push(resolve));
}
