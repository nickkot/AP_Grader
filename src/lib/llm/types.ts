/**
 * Types shared by the server and the local worker. No server-only imports here:
 * the worker on the teacher's Mac loads this file too.
 */

/** One piece of a user message. `cache` marks a long, repeated prefix (Anthropic prompt caching). */
export type LlmPart =
  | { type: "text"; text: string; cache?: boolean }
  | { type: "image"; mediaType: "image/jpeg" | "image/png"; data: string };

/** A complete model request in plain JSON, as the server hands it to a worker. */
export type WireRequest = {
  model: string;
  system: string;
  parts: LlmPart[];
  /** JSON Schema the answer must match. */
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
};

/** What a worker sends back: the parsed JSON answer and token counts. */
export type WireResult = {
  json: unknown;
  tokensIn: number;
  tokensOut: number;
  model: string;
};

export class LlmProviderError extends Error {}
