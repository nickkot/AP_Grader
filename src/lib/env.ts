import "server-only";
import { z } from "zod";

/**
 * Server environment. Every variable is documented in .env.example.
 * Parsed lazily so `next build` works without production secrets.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Email and password sign-in for local development and automated tests only. Refused on a deployed (public https) site. */
  ENABLE_DEV_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  STORAGE_DRIVER: z.enum(["s3", "local"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default(".data/uploads"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_KMS_KEY_ID: z.string().optional(),

  /** "anthropic" calls the API. "fake" returns deterministic canned output for local demos and tests. */
  MODEL_MODE: z.enum(["anthropic", "fake"]).default("fake"),
  ANTHROPIC_API_KEY: z.string().optional(),
  TRANSCRIBE_MODEL: z.string().default("claude-haiku-5-5"),
  TRANSCRIBE_RETRY_MODEL: z.string().default("claude-sonnet-5-5"),
  SCORING_MODEL: z.string().default("claude-sonnet-5-5"),
  SCORING_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  /** Pages whose mean word confidence falls below this are retried on the retry model. */
  TRANSCRIBE_RETRY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),

  /** "inngest" sends events to Inngest. "inline" runs jobs in-process after the response (local dev, tests). */
  JOBS_DRIVER: z.enum(["inngest", "inline"]).default("inline"),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  /* --- Model provider (src/lib/llm) ----------------------------------- */
  /** Who answers model calls made by this server. "openai" means any OpenAI-compatible endpoint. */
  LLM_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  /** Tried when the provider above errors or times out. "none" turns fallback off. */
  LLM_FALLBACK_PROVIDER: z.enum(["anthropic", "openai", "none"]).default("anthropic"),
  LLM_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(3600).default(120),
  OPENAI_COMPAT_BASE_URL: z.string().url().default("http://127.0.0.1:11434/v1"),
  OPENAI_COMPAT_API_KEY: z.string().optional(),
  OPENAI_COMPAT_MODEL: z.string().default("qwen3:32b"),
  OPENAI_COMPAT_VISION_MODEL: z.string().default("qwen2.5vl:32b"),

  /* --- Local worker queue (src/lib/llm-queue) ------------------------- */
  /** "local": queue the job for a worker on your own computer, with the cloud as fallback. "cloud": run it here. */
  LLM_ROUTE_TRANSCRIBE: z.enum(["local", "cloud"]).default("local"),
  /** Teacher-side scoring. Stays "cloud" until the local model passes the accuracy benchmark. Practice is always cloud. */
  LLM_ROUTE_SCORE: z.enum(["local", "cloud"]).default("cloud"),
  LLM_LOCAL_MODEL_TRANSCRIBE: z.string().default("qwen2.5vl:32b"),
  LLM_LOCAL_MODEL_SCORE: z.string().default("qwen3:32b"),
  /** A queued job nobody has finished after this long is run in the cloud instead. */
  LLM_LOCAL_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(86_400).default(600),
  /** At most this many jobs wait for the local worker at once; more go straight to the cloud. */
  LLM_LOCAL_MAX_QUEUE: z.coerce.number().int().min(1).max(10_000).default(5),
  /** How long a worker holds a job before it must report back or extend. */
  LLM_LEASE_SECONDS: z.coerce.number().int().min(30).max(7200).default(600),
  /** A worker not seen for this long counts as offline: new jobs go straight to the cloud. */
  LLM_WORKER_STALE_SECONDS: z.coerce.number().int().min(10).max(3600).default(90),
  /** Shared secret the local worker sends. Unset means no worker can connect and everything runs in the cloud. */
  LLM_WORKER_TOKEN: z.string().min(32).optional(),
  /** Comma-separated emails that may open /admin/llm. */
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** True for any https URL that is not localhost: a real deployment. */
export function isPublicUrl(url: string) {
  const u = new URL(url);
  return u.protocol === "https:" && !["localhost", "127.0.0.1"].includes(u.hostname);
}

/** For tests that change environment variables between cases. */
export function resetEnvCache() {
  cached = undefined;
}

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  const value = parsed.data;
  if (value.ENABLE_DEV_LOGIN && isPublicUrl(value.APP_URL)) {
    // Production builds also run locally and in CI, so the public URL is what marks a real deployment.
    throw new Error("ENABLE_DEV_LOGIN must be false on a deployed site.");
  }
  if (isPublicUrl(value.APP_URL)) {
    // A deployed site must never quietly fall back to fake scores, in-process jobs or local disk.
    if (value.MODEL_MODE !== "anthropic") throw new Error("A deployed site needs MODEL_MODE=anthropic.");
    if (value.JOBS_DRIVER !== "inngest") throw new Error("A deployed site needs JOBS_DRIVER=inngest.");
    if (value.STORAGE_DRIVER !== "s3") throw new Error("A deployed site needs STORAGE_DRIVER=s3.");
  }
  if (isPublicUrl(value.APP_URL) && value.LLM_PROVIDER === "openai" && /\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(value.OPENAI_COMPAT_BASE_URL)) {
    // The deployed server cannot reach a laptop. Local models run through the worker queue instead.
    throw new Error("A deployed site cannot use a localhost model server. Use LLM_ROUTE_* and the local worker.");
  }
  if (value.MODEL_MODE === "anthropic" && !value.ANTHROPIC_API_KEY) {
    throw new Error("MODEL_MODE=anthropic needs ANTHROPIC_API_KEY.");
  }
  if (value.STORAGE_DRIVER === "s3" && (!value.S3_BUCKET || !value.S3_REGION)) {
    throw new Error("STORAGE_DRIVER=s3 needs S3_BUCKET and S3_REGION.");
  }
  cached = value;
  return value;
}
