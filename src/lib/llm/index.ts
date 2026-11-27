import "server-only";
import type { z } from "zod";

import { ModelOutputError, type Usage } from "@/lib/ai/client";
import { env, type Env } from "@/lib/env";
import { anthropicComplete } from "@/lib/llm/anthropic";
import { toJsonSchema } from "@/lib/llm/json-schema";
import { openAiCompatibleComplete } from "@/lib/llm/openai-compatible";
import type { LlmPart } from "@/lib/llm/types";

/**
 * The one way this app calls a model. Every call names a task; the task decides the model,
 * effort and options for each provider. LLM_PROVIDER picks who answers, and on an error or
 * timeout LLM_FALLBACK_PROVIDER answers instead.
 */

export type LlmTask = "transcribe" | "transcribe_retry" | "score_row";
export type LlmProviderName = "anthropic" | "openai";

type TaskConfig = {
  anthropicModel: (e: Env) => string;
  openaiModel: (e: Env) => string;
  effort: (e: Env) => "low" | "medium" | "high";
  thinking: boolean;
  refusalFallback: boolean;
};

const TASKS: Record<LlmTask, TaskConfig> = {
  transcribe: {
    anthropicModel: (e) => e.TRANSCRIBE_MODEL,
    openaiModel: (e) => e.OPENAI_COMPAT_VISION_MODEL,
    effort: () => "low",
    thinking: false,
    refusalFallback: false,
  },
  transcribe_retry: {
    anthropicModel: (e) => e.TRANSCRIBE_RETRY_MODEL,
    openaiModel: (e) => e.OPENAI_COMPAT_VISION_MODEL,
    effort: () => "low",
    thinking: false,
    refusalFallback: false,
  },
  score_row: {
    anthropicModel: (e) => e.SCORING_MODEL,
    openaiModel: (e) => e.OPENAI_COMPAT_MODEL,
    effort: (e) => e.SCORING_EFFORT,
    thinking: true,
    refusalFallback: true,
  },
};

/** The model a task uses on a provider. */
export function modelFor(task: LlmTask, provider: LlmProviderName): string {
  const e = env();
  return provider === "anthropic" ? TASKS[task].anthropicModel(e) : TASKS[task].openaiModel(e);
}

/** The cloud model a task uses, for cost estimates. */
export function cloudModelFor(task: LlmTask): string {
  return TASKS[task].anthropicModel(env());
}

export type LlmRequest<T> = {
  task: LlmTask;
  system: string;
  parts: LlmPart[];
  schema: z.ZodType<T>;
  maxTokens?: number;
  /** Force a provider for this call, for example the cloud for a retry. Fallback still applies. */
  provider?: LlmProviderName;
};

export type LlmResult<T> = {
  output: T;
  usage: Usage;
  model: string;
  provider: LlmProviderName;
  /** True when the first provider failed and the fallback answered. */
  fellBack: boolean;
};

/** Check a model's JSON answer against the schema. Throws ModelOutputError when it does not match. */
export function parseAnswer<T>(schema: z.ZodType<T>, json: unknown): T {
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ModelOutputError("The answer did not match the expected format.");
  return parsed.data;
}

async function run<T>(provider: LlmProviderName, req: LlmRequest<T>) {
  const e = env();
  const task = TASKS[req.task];
  const maxTokens = req.maxTokens ?? 16_000;
  const timeoutMs = e.LLM_TIMEOUT_SECONDS * 1000;
  if (provider === "anthropic") {
    return anthropicComplete({
      model: task.anthropicModel(e),
      system: req.system,
      parts: req.parts,
      schema: req.schema,
      maxTokens,
      effort: task.effort(e),
      thinking: task.thinking,
      refusalFallback: task.refusalFallback,
      timeoutMs,
    });
  }
  const wire = await openAiCompatibleComplete(
    { baseUrl: e.OPENAI_COMPAT_BASE_URL, apiKey: e.OPENAI_COMPAT_API_KEY, timeoutMs },
    { model: task.openaiModel(e), system: req.system, parts: req.parts, jsonSchema: toJsonSchema(req.schema), maxTokens },
  );
  return {
    output: parseAnswer(req.schema, wire.json),
    usage: { inputTokens: wire.tokensIn, outputTokens: wire.tokensOut, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
    model: wire.model,
  };
}

export async function complete<T>(req: LlmRequest<T>): Promise<LlmResult<T>> {
  const e = env();
  const primary = req.provider ?? e.LLM_PROVIDER;
  try {
    return { ...(await run(primary, req)), provider: primary, fellBack: false };
  } catch (err) {
    const fallback = e.LLM_FALLBACK_PROVIDER;
    if (fallback === "none" || fallback === primary) throw err;
    console.warn(JSON.stringify({ level: "warn", msg: "model provider failed, using fallback", task: req.task, primary, fallback, err: String(err) }));
    return { ...(await run(fallback, req)), provider: fallback, fellBack: true };
  }
}
