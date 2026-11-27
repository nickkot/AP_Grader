import "server-only";

import { inngest } from "@/lib/jobs/inngest-client";
import { applyLocalResult, checkLlmJob, runJobInCloud } from "@/lib/llm-queue/process";
import { processPage, scoreSubmission, splitPdfBatch, transcribePageJob } from "@/lib/pipeline/run";

/**
 * Inngest functions. Each wraps one pipeline step; the step itself is idempotent,
 * so Inngest retries are safe. Concurrency limits keep model calls within rate limits.
 */

export const processPageFn = inngest.createFunction(
  { id: "process-page", triggers: [{ event: "page/process" }], concurrency: { limit: 20 }, retries: 3 },
  async ({ event, step }) => {
    await step.run("process", () => processPage(event.data.pageId as string));
  },
);

export const transcribePageFn = inngest.createFunction(
  { id: "transcribe-page", triggers: [{ event: "page/transcribe" }], concurrency: { limit: 20 }, retries: 3 },
  async ({ event, step }) => {
    await step.run("transcribe", () => transcribePageJob(event.data.pageId as string));
  },
);

export const splitPdfFn = inngest.createFunction(
  { id: "split-pdf", triggers: [{ event: "batch/split-pdf" }], concurrency: { limit: 4 }, retries: 2 },
  async ({ event, step }) => {
    await step.run("split", () => splitPdfBatch(event.data.batchId as string));
  },
);

export const scoreSubmissionFn = inngest.createFunction(
  { id: "score-submission", triggers: [{ event: "submission/score" }], concurrency: { limit: 10 }, retries: 2 },
  async ({ event, step }) => {
    await step.run("score", () => scoreSubmission(event.data.submissionId as string));
  },
);

/**
 * Watches one queued model job: sleeps until its deadline (or a worker's lease) and, if it is
 * still unfinished, runs it in the cloud. Durable sleeps survive deploys and restarts.
 */
export const watchLlmJobFn = inngest.createFunction(
  { id: "watch-llm-job", triggers: [{ event: "llm/job.watch" }], retries: 3 },
  async ({ event, step }) => {
    const jobId = event.data.jobId as string;
    for (let i = 0; i < 50; i++) {
      const result = await step.run(`check-${i}`, async () => {
        const r = await checkLlmJob(jobId);
        return r.done ? { done: true as const } : { done: false as const, waitUntil: r.waitUntil.toISOString() };
      });
      if (result.done) return;
      await step.sleepUntil(`wait-${i}`, new Date(result.waitUntil));
    }
  },
);

export const cloudLlmJobFn = inngest.createFunction(
  { id: "cloud-llm-job", triggers: [{ event: "llm/job.cloud" }], concurrency: { limit: 10 }, retries: 2 },
  async ({ event, step }) => {
    await step.run("cloud", () => runJobInCloud(event.data.jobId as string));
  },
);

export const applyLlmJobFn = inngest.createFunction(
  { id: "apply-llm-job", triggers: [{ event: "llm/job.apply" }], concurrency: { limit: 10 }, retries: 3 },
  async ({ event, step }) => {
    await step.run("apply", () => applyLocalResult(event.data.jobId as string));
  },
);

export const functions = [processPageFn, transcribePageFn, splitPdfFn, scoreSubmissionFn, watchLlmJobFn, cloudLlmJobFn, applyLlmJobFn];
