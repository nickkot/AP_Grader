import { LlmProviderError, type WireRequest, type WireResult } from "./types";

/**
 * Any OpenAI-compatible chat completions endpoint: Ollama (http://127.0.0.1:11434/v1),
 * a hosted open-model service, or OpenAI itself. Plain fetch, no SDK, no server-only
 * imports, so the local worker uses this same file.
 */

export type OpenAiCompatConfig = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  /** Aborts the request early, for example when the worker loses its claim or shuts down. */
  signal?: AbortSignal;
};

type ChatCompletion = {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** Models that think out loud wrap it in <think> tags; code fences sometimes surround the JSON. */
export function extractJson(content: string): unknown {
  const cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new LlmProviderError("The model's answer was not valid JSON.");
  }
}

export async function openAiCompatibleComplete(cfg: OpenAiCompatConfig, req: WireRequest): Promise<WireResult> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  const signal = cfg.signal ? AbortSignal.any([controller.signal, cfg.signal]) : controller.signal;
  const body = {
    model: req.model,
    max_tokens: req.maxTokens,
    stream: false,
    messages: [
      { role: "system", content: req.system },
      {
        role: "user",
        content: req.parts.map((p) =>
          p.type === "text"
            ? { type: "text", text: p.text }
            : { type: "image_url", image_url: { url: `data:${p.mediaType};base64,${p.data}` } },
        ),
      },
    ],
    response_format: { type: "json_schema", json_schema: { name: "answer", schema: req.jsonSchema, strict: true } },
  };

  try {
    let res: Response;
    try {
      res = await doFetch(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (cfg.signal?.aborted) throw new LlmProviderError("Stopped.");
      throw new LlmProviderError(controller.signal.aborted ? `No answer within ${Math.round(cfg.timeoutMs / 1000)} seconds.` : `Request failed: ${String(err)}`);
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new LlmProviderError(`HTTP ${res.status} from the model server. ${detail}`.trim());
    }

    let data: ChatCompletion;
    try {
      data = (await res.json()) as ChatCompletion;
    } catch {
      throw new LlmProviderError(signal.aborted ? "The answer stopped before it finished." : "The model server sent something other than JSON.");
    }
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") throw new LlmProviderError("The answer was cut off.");
    const content = choice?.message?.content;
    if (!content) throw new LlmProviderError("The model returned an empty answer.");
    return {
      json: extractJson(content),
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      model: data.model ?? req.model,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Model names the server offers, for example the ones pulled into Ollama. */
export async function listModels(cfg: OpenAiCompatConfig): Promise<string[]> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const res = await doFetch(`${cfg.baseUrl.replace(/\/+$/, "")}/models`, {
    headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new LlmProviderError(`HTTP ${res.status} listing models.`);
  const data = (await res.json()) as { data?: { id?: string }[] };
  return (data.data ?? []).map((m) => m.id ?? "").filter(Boolean);
}
