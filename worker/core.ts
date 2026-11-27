import { listModels, openAiCompatibleComplete } from "../src/lib/llm/openai-compatible";
import type { WireRequest } from "../src/lib/llm/types";

/**
 * The local model worker. It runs on the teacher's own computer, asks the AP Grader site
 * for work over HTTPS, runs each job against Ollama on this computer and sends the answer
 * back. Every connection goes out from here: nothing listens for incoming connections.
 * It keeps no copy of any page or essay, on disk or in logs.
 */

export const WORKER_VERSION = "1";

export type WorkerConfig = {
  /** The site, for example https://apgrader.example.com */
  siteUrl: string;
  token: string;
  /** Ollama on this computer, for example http://127.0.0.1:11434 */
  ollamaUrl: string;
  workerId: string;
  concurrency: number;
  pollSeconds: number;
  /** Longest a single model call may run before the worker gives up and hands the job back. */
  jobTimeoutSeconds: number;
};

export type ClaimedJob = { id: string; type: string; claimToken: string; leaseSeconds: number; request: WireRequest };

export type WorkerDeps = {
  fetchImpl: typeof fetch;
  log: (msg: string, fields?: Record<string, unknown>) => void;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
};

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Read and check settings. Throws with a plain message when something is missing or unsafe. */
export function loadConfig(env: Record<string, string | undefined>, hostname: string): WorkerConfig {
  const site = env.AP_GRADER_URL?.trim();
  if (!site) throw new Error("Set AP_GRADER_URL to your site's address, for example https://apgrader.example.com");
  const siteUrl = new URL(site);
  if (siteUrl.protocol !== "https:" && !LOOPBACK.has(siteUrl.hostname)) {
    throw new Error("AP_GRADER_URL must start with https:// so the token and student work are encrypted in transit.");
  }
  const token = env.LLM_WORKER_TOKEN?.trim() ?? "";
  if (token.length < 32) throw new Error("Set LLM_WORKER_TOKEN to the same value as on the server (at least 32 characters).");
  const ollamaUrl = new URL(env.OLLAMA_URL?.trim() || "http://127.0.0.1:11434");
  const int = (name: string, fallback: number, min: number, max: number) => {
    const raw = env[name]?.trim();
    const n = raw ? Number(raw) : fallback;
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
    return n;
  };
  return {
    siteUrl: siteUrl.origin,
    token,
    ollamaUrl: ollamaUrl.origin,
    workerId: (env.WORKER_ID?.trim() || hostname).slice(0, 100),
    concurrency: int("WORKER_CONCURRENCY", 1, 1, 8),
    pollSeconds: int("POLL_SECONDS", 5, 1, 300),
    jobTimeoutSeconds: int("JOB_TIMEOUT_SECONDS", 900, 30, 7200),
  };
}

/** Ollama lists "llama3:latest"; settings often say "llama3". Offer both spellings. */
export function advertisedModels(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    out.add(n);
    if (n.endsWith(":latest")) out.add(n.slice(0, -":latest".length));
  }
  return [...out].sort();
}

type SiteResponse = { status: number; body: Record<string, unknown> };

/** Calls to the site's worker API. */
export class SiteClient {
  constructor(
    private cfg: WorkerConfig,
    private fetchImpl: typeof fetch,
  ) {}

  private async post(path: string, body: unknown): Promise<SiteResponse> {
    const res = await this.fetchImpl(`${this.cfg.siteUrl}/api/llm-worker${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, body: parsed };
  }

  async claim(models: string[]): Promise<ClaimedJob | null> {
    const res = await this.post("/claim", { workerId: this.cfg.workerId, models, version: WORKER_VERSION });
    if (res.status === 401) throw new Error("The site refused the worker token. Check LLM_WORKER_TOKEN matches the server.");
    if (res.status !== 200) throw new Error(`The site answered ${res.status} when asked for work.`);
    return (res.body.job as ClaimedJob | null) ?? null;
  }

  action(jobId: string, action: "complete" | "fail" | "release" | "extend", body: Record<string, unknown>) {
    return this.post(`/jobs/${encodeURIComponent(jobId)}/${action}`, body);
  }
}

/** Short, content-free description of an error, safe for logs. */
function describe(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 300);
}

export type JobOutcome = "completed" | "rejected" | "failed" | "lost" | "released";

/**
 * Run one claimed job. While it runs, the lease is extended about every minute, which also
 * tells the site this computer is still awake. If the site says the job is no longer ours
 * (the cloud took it after this computer slept), the model call is stopped and nothing is sent.
 */
export async function runJob(cfg: WorkerConfig, site: SiteClient, job: ClaimedJob, deps: WorkerDeps, stop: AbortSignal): Promise<JobOutcome> {
  const started = Date.now();
  const lost = new AbortController();
  const signal = AbortSignal.any([lost.signal, stop]);
  const extendEveryMs = Math.max(5, Math.min(60, Math.floor(job.leaseSeconds / 3))) * 1000;
  const extender = setInterval(async () => {
    try {
      const res = await site.action(job.id, "extend", { claimToken: job.claimToken });
      if (res.status === 409) lost.abort();
    } catch (err) {
      deps.log("could not extend lease", { jobId: job.id, err: describe(err) });
    }
  }, extendEveryMs);
  const fields = { jobId: job.id, type: job.type, model: job.request.model };
  try {
    const result = await openAiCompatibleComplete(
      { baseUrl: `${cfg.ollamaUrl}/v1`, timeoutMs: cfg.jobTimeoutSeconds * 1000, fetchImpl: deps.fetchImpl, signal },
      job.request,
    );
    clearInterval(extender);
    if (lost.signal.aborted) return done("lost");
    if (stop.aborted) return release();
    const res = await site.action(job.id, "complete", {
      claimToken: job.claimToken,
      json: result.json,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      model: result.model,
    });
    const ms = Date.now() - started;
    if (res.status === 200) return done("completed", { ms, tokensIn: result.tokensIn, tokensOut: result.tokensOut });
    if (res.status === 422) return done("rejected", { ms });
    if (res.status === 409) return done("lost", { ms });
    throw new Error(`The site answered ${res.status} to the result.`);
  } catch (err) {
    clearInterval(extender);
    if (lost.signal.aborted) return done("lost");
    if (stop.aborted) return release();
    // Tell the site right away so the cloud can do the job without waiting for the deadline.
    await site.action(job.id, "fail", { claimToken: job.claimToken, error: describe(err) }).catch(() => {});
    return done("failed", { ms: Date.now() - started, err: describe(err) });
  }

  function done(outcome: JobOutcome, extra: Record<string, unknown> = {}): JobOutcome {
    deps.log(`job ${outcome}`, { ...fields, ...extra });
    return outcome;
  }
  async function release(): Promise<JobOutcome> {
    await site.action(job.id, "release", { claimToken: job.claimToken }).catch(() => {});
    return done("released");
  }
}

/** Models pulled into Ollama, or none when Ollama is not running. */
async function localModels(cfg: WorkerConfig, deps: WorkerDeps): Promise<string[]> {
  try {
    return advertisedModels(await listModels({ baseUrl: `${cfg.ollamaUrl}/v1`, timeoutMs: 10_000, fetchImpl: deps.fetchImpl }));
  } catch {
    return [];
  }
}

/**
 * Ask for work until stopped. Each ask doubles as a heartbeat. With no work the worker waits
 * POLL_SECONDS; when the site cannot be reached it waits longer each time, up to a minute.
 */
export async function pollLoop(cfg: WorkerConfig, deps: WorkerDeps, stop: AbortSignal, lane = 0): Promise<void> {
  const site = new SiteClient(cfg, deps.fetchImpl);
  let failures = 0;
  let ollamaWarned = false;
  while (!stop.aborted) {
    const models = await localModels(cfg, deps);
    if (models.length === 0 && !ollamaWarned) {
      deps.log("Ollama is not answering or has no models. The site will use the cloud until it does.", { lane, ollamaUrl: cfg.ollamaUrl });
    }
    ollamaWarned = models.length === 0;
    let job: ClaimedJob | null = null;
    try {
      job = await site.claim(models);
      failures = 0;
    } catch (err) {
      failures += 1;
      deps.log("could not reach the site", { lane, err: describe(err), retryInSeconds: Math.min(60, cfg.pollSeconds * 2 ** failures) });
    }
    if (job) {
      await runJob(cfg, site, job, deps, stop);
      continue;
    }
    const waitSeconds = failures > 0 ? Math.min(60, cfg.pollSeconds * 2 ** failures) : cfg.pollSeconds;
    await deps.sleep(waitSeconds * 1000, stop);
  }
}

/** Sleep that ends early when the signal fires. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
  });
}
