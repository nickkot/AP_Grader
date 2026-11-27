import "server-only";
import { eq } from "drizzle-orm";

import type { Usage } from "@/lib/ai/client";
import { checkRowOutput, RowOutputSchema, SCORING_SYSTEM, scoreRow, scoreRowParts } from "@/lib/ai/score";
import { finishTranscription, TRANSCRIBE_SYSTEM, transcribeParts, TranscriptionSchema } from "@/lib/ai/transcribe";
import { db } from "@/lib/db";
import { pages, scoreRuns, type LlmJobType } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { modelFor, parseAnswer } from "@/lib/llm";
import { toJsonSchema } from "@/lib/llm/json-schema";
import type { WireRequest } from "@/lib/llm/types";
import { enqueueJob, localModelFor, recordCloudCall, type LlmJob } from "@/lib/llm-queue/jobs";
import {
  finalizeRunIfDone,
  markPageUnreadable,
  prepareScoring,
  refreshSubmissionStatus,
  saveRowFailure,
  savePageTranscription,
  saveRowScore,
  transcribePageCloud,
} from "@/lib/pipeline/run";
import { getObject } from "@/lib/storage";

/**
 * What each job type does. A worker only ever receives a WireRequest: the prompt, the image
 * if any, and the JSON Schema. Everything else (retries, quote checks, saving) stays here.
 */
export type JobHandler = {
  /** The request for a worker, or null when the job no longer applies (page replaced, scoring cancelled). */
  buildRequest(job: LlmJob): Promise<WireRequest | null>;
  /** Throws when a worker's answer does not match the schema. */
  validate(json: unknown): void;
  /** Use a local worker's stored answer. */
  applyLocal(job: LlmJob): Promise<void>;
  /** Do the whole job here, in the cloud. Null when the job no longer applies. */
  runCloud(job: LlmJob): Promise<{ model: string; usage: Usage } | null>;
};

const localUsage = (job: LlmJob): Usage => ({
  inputTokens: job.tokensIn ?? 0,
  outputTokens: job.tokensOut ?? 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
});

/* --- Page transcription ---------------------------------------------------- */

async function pageToRead(job: LlmJob) {
  const pageId = String(job.input.pageId ?? "");
  const page = pageId ? await db.query.pages.findFirst({ where: eq(pages.id, pageId) }) : undefined;
  return page && page.status === "transcribing" && page.processedKey ? page : null;
}

const transcribePageHandler: JobHandler = {
  async buildRequest(job) {
    const page = await pageToRead(job);
    if (!page) return null;
    const image = await getObject(page.processedKey!);
    return {
      model: localModelFor("transcribe_page"),
      system: TRANSCRIBE_SYSTEM,
      parts: transcribeParts(image, "image/jpeg"),
      jsonSchema: toJsonSchema(TranscriptionSchema),
      maxTokens: 16_000,
    };
  },
  validate(json) {
    parseAnswer(TranscriptionSchema, json);
  },
  async applyLocal(job) {
    const page = await pageToRead(job);
    if (!page) return;
    const data = parseAnswer(TranscriptionSchema, job.output);
    const first = { data, usage: localUsage(job), model: job.model ?? "local" };
    try {
      const image = await getObject(page.processedKey!);
      // If the cloud re-read of a low-confidence page fails, keep the local reading.
      const result = await finishTranscription(first, image).catch((err) => {
        console.warn(JSON.stringify({ level: "warn", msg: "cloud re-read failed, keeping local reading", jobId: job.id, err: String(err) }));
        return finishTranscription(first, image, "image/jpeg", false);
      });
      if (result.retried) {
        // The low-confidence re-read ran here, in the cloud. Record its cost on its own row.
        await recordCloudCall(
          "transcribe_page",
          { pageId: page.id, retryOf: job.id },
          { model: modelFor("transcribe_retry", env().LLM_PROVIDER), usage: { ...result.usage, inputTokens: result.usage.inputTokens - (job.tokensIn ?? 0), outputTokens: result.usage.outputTokens - (job.tokensOut ?? 0) } },
        );
      }
      await savePageTranscription(page.id, result);
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "applying local transcription failed", jobId: job.id, err: String(err) }));
      await markPageUnreadable(page.id);
    } finally {
      if (page.submissionId) await refreshSubmissionStatus(page.submissionId);
    }
  },
  async runCloud(job) {
    if (!(await pageToRead(job))) return null;
    const result = await transcribePageCloud(String(job.input.pageId));
    if (!result) throw new Error("This page could not be read.");
    return { model: result.model, usage: result.usage };
  },
};

/* --- Rubric row scoring ---------------------------------------------------- */

type RowInput = { submissionId: string; scoreRunId: string; rowKey: string; attempt: number; retryNote?: string };

function rowInput(job: LlmJob): RowInput {
  const i = job.input;
  return {
    submissionId: String(i.submissionId ?? ""),
    scoreRunId: String(i.scoreRunId ?? ""),
    rowKey: String(i.rowKey ?? ""),
    attempt: Number(i.attempt ?? 1),
    retryNote: typeof i.retryNote === "string" ? i.retryNote : undefined,
  };
}

/** The prepared essay and row for a row job, or null when its run was cancelled or replaced. */
async function rowToScore(job: LlmJob) {
  const input = rowInput(job);
  const run = await db.query.scoreRuns.findFirst({ where: eq(scoreRuns.id, input.scoreRunId) });
  if (!run || run.status !== "running") return null;
  const prepared = await prepareScoring(input.submissionId);
  if (!prepared || prepared === "empty") return null;
  const row = prepared.rubric.rows.find((r) => r.key === input.rowKey);
  return row ? { input, prepared, row } : null;
}

const scoreRowHandler: JobHandler = {
  async buildRequest(job) {
    const found = await rowToScore(job);
    if (!found) return null;
    return {
      model: localModelFor("score_row"),
      system: SCORING_SYSTEM,
      parts: scoreRowParts(found.prepared.contextBlock, found.row, found.input.retryNote),
      jsonSchema: toJsonSchema(RowOutputSchema),
      maxTokens: 16_000,
    };
  },
  validate(json) {
    parseAnswer(RowOutputSchema, json);
  },
  async applyLocal(job) {
    const found = await rowToScore(job);
    if (!found) return;
    const output = parseAnswer(RowOutputSchema, job.output);
    const issues = checkRowOutput(found.row, output);
    if (issues.length > 0 && found.input.attempt < 2) {
      // Same rule as the cloud: one retry with the problems named.
      await enqueueJob("score_row", { ...found.input, attempt: 2, retryNote: issues.join(" ") });
      return;
    }
    await saveRowScore(found.input.scoreRunId, found.prepared, found.row, { output, feedbackIssues: issues });
    await finalizeRunIfDone(found.input.scoreRunId);
  },
  async runCloud(job) {
    const found = await rowToScore(job);
    if (!found) return null;
    try {
      const result = await scoreRow(found.prepared.ctx, found.prepared.contextBlock, found.row);
      await saveRowScore(found.input.scoreRunId, found.prepared, found.row, result);
      return { model: result.model, usage: result.usage };
    } catch (err) {
      await saveRowFailure(found.input.scoreRunId, found.input.submissionId, found.row);
      throw err;
    } finally {
      await finalizeRunIfDone(found.input.scoreRunId);
    }
  },
};

export const HANDLERS: Record<LlmJobType, JobHandler> = {
  transcribe_page: transcribePageHandler,
  score_row: scoreRowHandler,
};
