import "server-only";
import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

let client: Anthropic | undefined;

export function anthropic(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: env().ANTHROPIC_API_KEY,
      maxRetries: 3,
      timeout: 120_000,
    });
  }
  return client;
}

/** Per-million-token prices in USD. Keep in sync with Anthropic's pricing page. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
};

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };

export function usageFrom(
  model: string,
  u: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  },
): Usage {
  const p = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const costUsd =
    (u.input_tokens * p.input + u.output_tokens * p.output + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) /
    1_000_000;
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    costUsd,
  };
}

/** What these tokens would cost on a cloud model, with no caching. Used to estimate savings from local runs. */
export function estimateCloudCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
  return (tokensIn * p.input + tokensOut * p.output) / 1_000_000;
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

export class ModelOutputError extends Error {}
