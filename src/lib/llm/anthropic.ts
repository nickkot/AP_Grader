import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

import { anthropic, ModelOutputError, usageFrom, type Usage } from "@/lib/ai/client";
import type { LlmPart } from "@/lib/llm/types";

export type AnthropicOptions<T> = {
  model: string;
  system: string;
  parts: LlmPart[];
  schema: z.ZodType<T>;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  /** Adaptive thinking (scoring). */
  thinking: boolean;
  /** Server-side refusal fallback to another model (scoring on Sonnet or Opus). */
  refusalFallback: boolean;
  timeoutMs: number;
};

function content(parts: LlmPart[]) {
  return parts.map((p) =>
    p.type === "text"
      ? { type: "text" as const, text: p.text, ...(p.cache ? { cache_control: { type: "ephemeral" as const } } : {}) }
      : { type: "image" as const, source: { type: "base64" as const, media_type: p.mediaType, data: p.data } },
  );
}

/** Claude through the official SDK, with structured output, prompt caching and, for scoring, adaptive thinking. */
export async function anthropicComplete<T>(o: AnthropicOptions<T>): Promise<{ output: T; usage: Usage; model: string }> {
  const format = zodOutputFormat(o.schema as z.ZodType);
  const request = { timeout: o.timeoutMs };
  const response = o.refusalFallback
    ? await anthropic().beta.messages.parse(
        {
          model: o.model,
          max_tokens: o.maxTokens,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: o.system,
          ...(o.thinking ? { thinking: { type: "adaptive" as const } } : {}),
          output_config: { effort: o.effort, format },
          messages: [{ role: "user", content: content(o.parts) as Anthropic.Beta.BetaContentBlockParam[] }],
        },
        request,
      )
    : await anthropic().messages.parse(
        {
          model: o.model,
          max_tokens: o.maxTokens,
          system: o.system,
          ...(o.thinking ? { thinking: { type: "adaptive" as const } } : {}),
          output_config: { effort: o.effort, format },
          messages: [{ role: "user", content: content(o.parts) as Anthropic.ContentBlockParam[] }],
        },
        request,
      );

  if (response.stop_reason === "refusal") throw new ModelOutputError("The model declined this request.");
  if (response.stop_reason === "max_tokens") throw new ModelOutputError("The answer was cut off.");
  const parsed = o.schema.safeParse(response.parsed_output);
  if (!parsed.success) throw new ModelOutputError("The answer did not match the expected format.");
  const model = response.model ?? o.model;
  return { output: parsed.data, usage: usageFrom(model, response.usage), model };
}
