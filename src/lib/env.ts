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
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** True for any https URL that is not localhost: a real deployment. */
export function isPublicUrl(url: string) {
  const u = new URL(url);
  return u.protocol === "https:" && !["localhost", "127.0.0.1"].includes(u.hostname);
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
  if (value.MODEL_MODE === "anthropic" && !value.ANTHROPIC_API_KEY) {
    throw new Error("MODEL_MODE=anthropic needs ANTHROPIC_API_KEY.");
  }
  if (value.STORAGE_DRIVER === "s3" && (!value.S3_BUCKET || !value.S3_REGION)) {
    throw new Error("STORAGE_DRIVER=s3 needs S3_BUCKET and S3_REGION.");
  }
  cached = value;
  return value;
}
