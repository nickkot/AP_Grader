export type JobEvent =
  | { name: "page/process"; data: { pageId: string } }
  | { name: "page/transcribe"; data: { pageId: string } }
  | { name: "batch/split-pdf"; data: { batchId: string } }
  | { name: "submission/score"; data: { submissionId: string } }
  /** Check a queued model job: run it in the cloud if its deadline or lease has passed. */
  | { name: "llm/job.watch"; data: { jobId: string } }
  /** Run a model job in the cloud now (a worker failed, or the job was routed to the cloud). */
  | { name: "llm/job.cloud"; data: { jobId: string } }
  /** Use a local worker's answer: save the transcription or row score. */
  | { name: "llm/job.apply"; data: { jobId: string } };
