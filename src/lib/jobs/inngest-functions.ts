import "server-only";

import { inngest } from "@/lib/jobs/inngest-client";
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

export const functions = [processPageFn, transcribePageFn, splitPdfFn, scoreSubmissionFn];
