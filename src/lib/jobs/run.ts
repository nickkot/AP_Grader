import "server-only";

import type { JobEvent } from "@/lib/jobs/events";
import { enqueueAt } from "@/lib/jobs";
import { applyLocalResult, checkLlmJob, runJobInCloud } from "@/lib/llm-queue/process";
import { processPage, scoreSubmission, splitPdfBatch, transcribePageJob } from "@/lib/pipeline/run";

export async function runJob(event: JobEvent): Promise<void> {
  switch (event.name) {
    case "page/process":
      return processPage(event.data.pageId);
    case "page/transcribe":
      return transcribePageJob(event.data.pageId);
    case "batch/split-pdf":
      return splitPdfBatch(event.data.batchId);
    case "submission/score":
      return scoreSubmission(event.data.submissionId);
    case "llm/job.watch": {
      // Inline driver: check now, and come back later without holding a worker slot.
      const result = await checkLlmJob(event.data.jobId);
      if (!result.done) enqueueAt(event, result.waitUntil);
      return;
    }
    case "llm/job.cloud":
      return runJobInCloud(event.data.jobId);
    case "llm/job.apply":
      return applyLocalResult(event.data.jobId);
  }
}
