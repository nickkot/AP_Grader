import { afterEach, describe, expect, it, vi } from "vitest";

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://x",
  BETTER_AUTH_SECRET: "x".repeat(40),
};

async function envWith(vars: Record<string, string>) {
  vi.resetModules();
  process.env = { ...base, ...vars } as unknown as NodeJS.ProcessEnv;
  const { env } = await import("@/lib/env");
  return env;
}

describe("env guards", () => {
  afterEach(() => vi.resetModules());

  it("allows dev login and fake models on localhost", async () => {
    const saved = { ...process.env };
    const env = await envWith({ APP_URL: "http://localhost:3000", ENABLE_DEV_LOGIN: "true", MODEL_MODE: "fake" });
    expect(env().ENABLE_DEV_LOGIN).toBe(true);
    process.env = saved;
  });

  it("refuses dev login, fake models, inline jobs and local storage on a deployed site", async () => {
    const cases: Record<string, string>[] = [
      { ENABLE_DEV_LOGIN: "true" },
      { MODEL_MODE: "fake" },
      { MODEL_MODE: "anthropic", ANTHROPIC_API_KEY: "k", JOBS_DRIVER: "inline", STORAGE_DRIVER: "s3", S3_BUCKET: "b", S3_REGION: "r" },
      { MODEL_MODE: "anthropic", ANTHROPIC_API_KEY: "k", JOBS_DRIVER: "inngest", STORAGE_DRIVER: "local" },
    ];
    for (const c of cases) {
      vi.resetModules();
      const saved = { ...process.env };
      process.env = { ...base, APP_URL: "https://app.example.com", ...c } as unknown as NodeJS.ProcessEnv;
      const { env } = await import("@/lib/env");
      expect(() => env()).toThrow();
      process.env = saved;
    }
  });

  it("accepts a complete production configuration", async () => {
    vi.resetModules();
    const saved = { ...process.env };
    process.env = {
      ...base,
      APP_URL: "https://app.example.com",
      MODEL_MODE: "anthropic",
      ANTHROPIC_API_KEY: "k",
      JOBS_DRIVER: "inngest",
      STORAGE_DRIVER: "s3",
      S3_BUCKET: "b",
      S3_REGION: "us-east-1",
    } as unknown as NodeJS.ProcessEnv;
    const { env } = await import("@/lib/env");
    expect(env().MODEL_MODE).toBe("anthropic");
    process.env = saved;
  });
});
