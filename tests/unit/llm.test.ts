/**
 * The model layer without a network: the OpenAI-compatible adapter Ollama uses, the
 * provider fallback in complete(), and the local worker's settings and job handling.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const anthropicComplete = vi.fn();
vi.mock("@/lib/llm/anthropic", () => ({ anthropicComplete: (...args: unknown[]) => anthropicComplete(...args) }));

const { extractJson, listModels, openAiCompatibleComplete } = await import("@/lib/llm/openai-compatible");
const { LlmProviderError } = await import("@/lib/llm/types");
const { complete } = await import("@/lib/llm");
const { resetEnvCache } = await import("@/lib/env");
const { advertisedModels, loadConfig, runJob, SiteClient } = await import("../../worker/core");

type Call = { url: string; init: RequestInit };

/** A fetch that records calls and answers from a script. */
function fakeFetch(answer: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return answer(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

/** Like a request that never answers: it only ends when its signal aborts, as fetch does. */
const hangUntilAborted = (init: RequestInit) =>
  new Promise<Response>((_, reject) => {
    const fail = () => reject(new DOMException("aborted", "AbortError"));
    if (init.signal?.aborted) return fail();
    init.signal?.addEventListener("abort", fail);
  });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const chat = (content: string, extra: Record<string, unknown> = {}) =>
  json({ model: "qwen3:32b", choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 120, completion_tokens: 30 }, ...extra });

const REQUEST = {
  model: "qwen2.5vl:32b",
  system: "Transcribe.",
  parts: [
    { type: "text" as const, text: "Read this page.", cache: true },
    { type: "image" as const, mediaType: "image/jpeg" as const, data: "AAAA" },
  ],
  jsonSchema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
  maxTokens: 500,
};

describe("OpenAI-compatible adapter", () => {
  it("sends the system prompt, text, image and JSON Schema in the chat completions shape", async () => {
    const { impl, calls } = fakeFetch(() => chat('{"ok":true}'));
    const out = await openAiCompatibleComplete({ baseUrl: "http://127.0.0.1:11434/v1/", timeoutMs: 1000, fetchImpl: impl }, REQUEST);
    expect(out).toEqual({ json: { ok: true }, tokensIn: 120, tokensOut: 30, model: "qwen3:32b" });

    expect(calls[0].url).toBe("http://127.0.0.1:11434/v1/chat/completions");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ model: "qwen2.5vl:32b", max_tokens: 500, stream: false });
    expect(body.messages[0]).toEqual({ role: "system", content: "Transcribe." });
    expect(body.messages[1].content).toEqual([
      { type: "text", text: "Read this page." },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
    ]);
    expect(body.response_format).toEqual({ type: "json_schema", json_schema: { name: "answer", schema: REQUEST.jsonSchema, strict: true } });
    expect(new Headers(calls[0].init.headers).has("authorization")).toBe(false);
  });

  it("sends an API key only when one is set", async () => {
    const { impl, calls } = fakeFetch(() => chat('{"ok":true}'));
    await openAiCompatibleComplete({ baseUrl: "https://models.example.com/v1", apiKey: "k-123", timeoutMs: 1000, fetchImpl: impl }, REQUEST);
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe("Bearer k-123");
  });

  it("drops thinking and code fences around the JSON", () => {
    expect(extractJson('<think>\nLet me look.\n</think>\n```json\n{"ok": true}\n```')).toEqual({ ok: true });
    expect(() => extractJson("I think it says hello")).toThrow(LlmProviderError);
  });

  it("turns HTTP errors, cut-off answers and empty answers into provider errors", async () => {
    const cases: [Response, RegExp][] = [
      [new Response("model not found", { status: 404 }), /HTTP 404.*model not found/],
      [json({ choices: [{ message: { content: '{"ok":' }, finish_reason: "length" }] }), /cut off/],
      [json({ choices: [{ message: { content: "" }, finish_reason: "stop" }] }), /empty/],
    ];
    for (const [response, message] of cases) {
      const { impl } = fakeFetch(() => response);
      await expect(openAiCompatibleComplete({ baseUrl: "http://x/v1", timeoutMs: 1000, fetchImpl: impl }, REQUEST)).rejects.toThrow(message);
    }
  });

  it("gives up after the timeout, and stops when asked", async () => {
    const hang = fakeFetch((_url, init) => hangUntilAborted(init));
    await expect(openAiCompatibleComplete({ baseUrl: "http://x/v1", timeoutMs: 20, fetchImpl: hang.impl }, REQUEST)).rejects.toThrow(/No answer within/);

    const stop = new AbortController();
    const pending = openAiCompatibleComplete({ baseUrl: "http://x/v1", timeoutMs: 60_000, fetchImpl: hang.impl, signal: stop.signal }, REQUEST);
    stop.abort();
    await expect(pending).rejects.toThrow("Stopped.");
  });

  it("lists the models the server has", async () => {
    const { impl, calls } = fakeFetch(() => json({ data: [{ id: "qwen3:32b" }, { id: "qwen2.5vl:32b" }] }));
    expect(await listModels({ baseUrl: "http://127.0.0.1:11434/v1", timeoutMs: 1000, fetchImpl: impl })).toEqual(["qwen3:32b", "qwen2.5vl:32b"]);
    expect(calls[0].url).toBe("http://127.0.0.1:11434/v1/models");
  });
});

describe("complete() provider fallback", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetEnvCache();
    anthropicComplete.mockReset();
    vi.unstubAllGlobals();
  });

  const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.001 };
  const req = { task: "score_row" as const, system: "s", parts: [{ type: "text" as const, text: "t" }], schema: z.object({ ok: z.boolean() }) };

  it("answers from the OpenAI-compatible server when it is the provider", async () => {
    process.env.LLM_PROVIDER = "openai";
    resetEnvCache();
    vi.stubGlobal("fetch", fakeFetch(() => chat('{"ok":true}')).impl);
    const out = await complete(req);
    expect(out).toMatchObject({ output: { ok: true }, provider: "openai", fellBack: false, usage: { inputTokens: 120, outputTokens: 30, costUsd: 0 } });
    expect(anthropicComplete).not.toHaveBeenCalled();
  });

  it("falls back to the cloud when the local server fails or answers in the wrong shape", async () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_FALLBACK_PROVIDER = "anthropic";
    resetEnvCache();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    anthropicComplete.mockResolvedValue({ output: { ok: false }, usage, model: "claude-sonnet-5-5" });

    vi.stubGlobal("fetch", fakeFetch(() => new Response("busy", { status: 503 })).impl);
    expect(await complete(req)).toMatchObject({ output: { ok: false }, provider: "anthropic", fellBack: true, model: "claude-sonnet-5-5" });

    vi.stubGlobal("fetch", fakeFetch(() => chat('{"ok":"yes"}')).impl);
    expect(await complete(req)).toMatchObject({ provider: "anthropic", fellBack: true });
    expect(anthropicComplete).toHaveBeenCalledTimes(2);
  });

  it("throws instead of falling back when fallback is off", async () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_FALLBACK_PROVIDER = "none";
    resetEnvCache();
    vi.stubGlobal("fetch", fakeFetch(() => new Response("busy", { status: 503 })).impl);
    await expect(complete(req)).rejects.toThrow(/HTTP 503/);
    expect(anthropicComplete).not.toHaveBeenCalled();
  });
});

describe("local worker", () => {
  const TOKEN = "w".repeat(40);
  const base = { AP_GRADER_URL: "https://apgrader.example.com/", LLM_WORKER_TOKEN: TOKEN };

  it("reads its settings, with safe defaults", () => {
    expect(loadConfig(base, "macbook")).toEqual({
      siteUrl: "https://apgrader.example.com",
      token: TOKEN,
      ollamaUrl: "http://127.0.0.1:11434",
      workerId: "macbook",
      concurrency: 1,
      pollSeconds: 5,
      jobTimeoutSeconds: 900,
    });
    expect(loadConfig({ ...base, AP_GRADER_URL: "http://localhost:3000", WORKER_ID: "lab" }, "macbook")).toMatchObject({ siteUrl: "http://localhost:3000", workerId: "lab" });
  });

  it("refuses plain http to a real site, a short token and odd numbers", () => {
    expect(() => loadConfig({ ...base, AP_GRADER_URL: "http://apgrader.example.com" }, "m")).toThrow(/https/);
    expect(() => loadConfig({ ...base, LLM_WORKER_TOKEN: "short" }, "m")).toThrow(/LLM_WORKER_TOKEN/);
    expect(() => loadConfig({ ...base, AP_GRADER_URL: undefined }, "m")).toThrow(/AP_GRADER_URL/);
    expect(() => loadConfig({ ...base, POLL_SECONDS: "0" }, "m")).toThrow(/POLL_SECONDS/);
  });

  it("offers model names with and without the :latest tag", () => {
    expect(advertisedModels(["llama3:latest", "qwen3:32b"])).toEqual(["llama3", "llama3:latest", "qwen3:32b"]);
  });

  const cfg = loadConfig(base, "macbook");
  const job = { id: "11111111-1111-4111-8111-111111111111", type: "score_row", claimToken: "22222222-2222-4222-8222-222222222222", leaseSeconds: 600, request: REQUEST };
  const deps = (impl: typeof fetch) => ({ fetchImpl: impl, log: () => {}, sleep: async () => {} });

  it("runs a job on Ollama and sends back only the answer and token counts", async () => {
    const { impl, calls } = fakeFetch((url) => (url.includes("11434") ? chat('{"ok":true}') : json({ ok: true })));
    const outcome = await runJob(cfg, new SiteClient(cfg, impl), job, deps(impl), new AbortController().signal);
    expect(outcome).toBe("completed");

    expect(calls.map((c) => c.url)).toEqual([
      "http://127.0.0.1:11434/v1/chat/completions",
      `https://apgrader.example.com/api/llm-worker/jobs/${job.id}/complete`,
    ]);
    const report = calls[1];
    expect(new Headers(report.init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(String(report.init.body))).toEqual({ claimToken: job.claimToken, json: { ok: true }, tokensIn: 120, tokensOut: 30, model: "qwen3:32b" });
  });

  it("tells the site right away when Ollama fails, so the cloud takes the job", async () => {
    const { impl, calls } = fakeFetch((url) => (url.includes("11434") ? new Response("out of memory", { status: 500 }) : json({ ok: true })));
    expect(await runJob(cfg, new SiteClient(cfg, impl), job, deps(impl), new AbortController().signal)).toBe("failed");
    expect(calls[1].url).toMatch(/\/fail$/);
    const body = JSON.parse(String(calls[1].init.body));
    expect(body.claimToken).toBe(job.claimToken);
    expect(body.error).toMatch(/HTTP 500/);
  });

  it("hands the job back when stopped mid-job", async () => {
    const stop = new AbortController();
    const { impl, calls } = fakeFetch((url, init) => {
      if (!url.includes("11434")) return json({ ok: true });
      stop.abort();
      return hangUntilAborted(init);
    });
    expect(await runJob(cfg, new SiteClient(cfg, impl), job, deps(impl), stop.signal)).toBe("released");
    expect(calls.at(-1)?.url).toMatch(/\/release$/);
  });

  it("stops and sends nothing once the site says the job is no longer its own", async () => {
    vi.useFakeTimers();
    try {
      const { impl, calls } = fakeFetch((url, init) => {
        if (url.endsWith("/extend")) return json({ error: "gone" }, 409);
        if (!url.includes("11434")) return json({ ok: true });
        return hangUntilAborted(init);
      });
      const outcome = runJob(cfg, new SiteClient(cfg, impl), job, deps(impl), new AbortController().signal);
      await vi.advanceTimersByTimeAsync(61_000);
      expect(await outcome).toBe("lost");
      expect(calls.some((c) => /\/(complete|fail|release)$/.test(c.url))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
