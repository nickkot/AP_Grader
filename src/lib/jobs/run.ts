import "server-only";

import type { JobEvent } from "@/lib/jobs/events";
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
  }
}
