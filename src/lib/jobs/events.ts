export type JobEvent =
  | { name: "page/process"; data: { pageId: string } }
  | { name: "page/transcribe"; data: { pageId: string } }
  | { name: "batch/split-pdf"; data: { batchId: string } }
  | { name: "submission/score"; data: { submissionId: string } };
