/**
 * Start the local model worker. Run it with worker/run.sh (which keeps the Mac awake) or:
 *   node --import tsx worker/llm-worker.ts
 * Settings come from worker/.env. See worker/.env.example and the README.
 */
import { hostname } from "node:os";
import path from "node:path";
import { config as loadEnvFile } from "dotenv";

import { loadConfig, pollLoop, sleep, WORKER_VERSION, type WorkerConfig, type WorkerDeps } from "./core";

// The repo runs TypeScript as CommonJS, so __dirname is this folder.
loadEnvFile({ path: path.join(__dirname, ".env"), quiet: true });

function log(msg: string, fields: Record<string, unknown> = {}) {
  // Ids, counts and timings only. Never prompts, images or answers.
  console.log(JSON.stringify({ time: new Date().toISOString(), msg, ...fields }));
}

function readConfig(): WorkerConfig {
  try {
    return loadConfig(process.env, hostname());
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
const cfg = readConfig();

const stop = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stop.signal.aborted) process.exit(1);
    log("stopping: handing back any job in progress");
    stop.abort();
  });
}

async function main() {
  const deps: WorkerDeps = { fetchImpl: fetch, log, sleep };
  log("worker started", { workerId: cfg.workerId, site: cfg.siteUrl, ollama: cfg.ollamaUrl, lanes: cfg.concurrency, version: WORKER_VERSION });
  await Promise.all(Array.from({ length: cfg.concurrency }, (_, lane) => pollLoop(cfg, deps, stop.signal, lane)));
  log("worker stopped");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
