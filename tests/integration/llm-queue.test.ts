/**
 * The local model queue against the test database, with fake cloud models: atomic claims
 * under concurrency, the deadline and lease fallbacks to the cloud, the worker API round
 * trip for transcription and scoring, token checks on the endpoints, and monthly savings.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "../support/db";

const TOKEN = "test-worker-token-0123456789abcdef0123456789";
const ENV_KEYS = ["LLM_WORKER_TOKEN", "LLM_ROUTE_TRANSCRIBE", "LLM_ROUTE_SCORE", "LLM_LOCAL_MAX_QUEUE"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

const { env, resetEnvCache } = await import("@/lib/env");
const { db } = await import("@/lib/db");
const schema = await import("@/lib/db/schema");
const { drainInlineJobs } = await import("@/lib/jobs");
const q = await import("@/lib/llm-queue/jobs");
const { checkLlmJob } = await import("@/lib/llm-queue/process");
const { handleClaim, handleJobAction } = await import("@/lib/llm-queue/worker-api");
const { monthlySavings } = await import("@/lib/llm-queue/savings");
const { scoreSubmission, transcribePageJob } = await import("@/lib/pipeline/run");
const { putObject } = await import("@/lib/storage");
const { feedbackViolations } = await import("@/lib/copy/banned");
const { rubricForEssayType } = await import("@/lib/rubrics");
const { DEMO_DBQ } = await import("@/lib/demo/content");
const claimRoute = await import("@/app/api/llm-worker/claim/route");
const actionRoute = await import("@/app/api/llm-worker/jobs/[id]/[action]/route");

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCache();
}

const VISION = () => env().LLM_LOCAL_MODEL_TRANSCRIBE;
const TEXT = () => env().LLM_LOCAL_MODEL_SCORE;
const later = (seconds: number) => new Date(Date.now() + seconds * 1000);

async function jobRow(id: string) {
  return (await db.query.llmJobs.findFirst({ where: eq(schema.llmJobs.id, id) }))!;
}

/** A teacher, a class with two students and a DBQ assignment. */
async function makeAssignment() {
  const teacherId = randomUUID();
  await db.insert(schema.user).values({ id: teacherId, name: "Test Teacher", email: `${teacherId}@example.com` });
  const [cls] = await db.insert(schema.classes).values({ teacherId, course: "APUSH", name: "Period 2" }).returning();
  const roster = await db
    .insert(schema.students)
    .values([
      { classId: cls.id, teacherId, firstName: "Maya", lastName: "Jackson" },
      { classId: cls.id, teacherId, firstName: "Daniel", lastName: "Reyes" },
    ])
    .returning();
  const rubric = rubricForEssayType("APUSH_DBQ");
  const [assignment] = await db
    .insert(schema.assignments)
    .values({
      teacherId,
      classId: cls.id,
      essayType: "APUSH_DBQ",
      title: DEMO_DBQ.title,
      promptText: DEMO_DBQ.promptText,
      sources: DEMO_DBQ.sources,
      timeLimitMinutes: 60,
      answerPagesPerStudent: 2,
      rubricKey: rubric.key,
      rubricVersion: rubric.version,
    })
    .returning();
  return { teacherId, roster, assignment, rubric };
}

/** A processed page waiting to be read, attached to a submission. */
async function makePageToRead() {
  const { teacherId, roster, assignment } = await makeAssignment();
  const [sub] = await db
    .insert(schema.submissions)
    .values({ assignmentId: assignment.id, studentId: roster[0].id, inputKind: "handwritten", status: "transcribing" })
    .returning();
  const image = await sharp({ create: { width: 400, height: 520, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
  const id = randomUUID();
  const key = `assignments/${assignment.id}/pages/${id}.jpg`;
  await putObject(key, image, "image/jpeg");
  await db.insert(schema.pages).values({
    id,
    assignmentId: assignment.id,
    submissionId: sub.id,
    pageNumber: 1,
    matchMethod: "qr",
    originalKey: key,
    processedKey: key,
    contentType: "image/jpeg",
    sizeBytes: image.length,
    sha256: "x".repeat(64),
    uploadedBy: teacherId,
    status: "transcribing",
  });
  return { pageId: id, submissionId: sub.id, image };
}

const TRANSCRIPTION = {
  page_is_blank: false,
  lines: [
    { words: ["Reformers", "pushed", "for", "abolition"].map((text) => ({ text, confidence: 0.97, deleted: false, illegible: false })) },
    { words: ["and", "the", "vote", "for", "women."].map((text) => ({ text, confidence: 0.95, deleted: false, illegible: false })) },
  ],
};

/** Ask for work the way the worker does. */
async function claim(models: string[], workerId = "test-mac") {
  return (await handleClaim({ workerId, models, version: "1" })).job;
}

beforeAll(async () => {
  await resetTestDb();
});

beforeEach(async () => {
  await db.execute(sql`truncate table llm_jobs, llm_worker`);
  setEnv({ LLM_WORKER_TOKEN: TOKEN, LLM_ROUTE_TRANSCRIBE: "local", LLM_ROUTE_SCORE: "local", LLM_LOCAL_MAX_QUEUE: "50" });
});

afterEach(async () => {
  await drainInlineJobs();
  setEnv(savedEnv);
});

describe("claiming jobs", () => {
  it("gives one job to exactly one of ten workers asking at the same moment", async () => {
    const job = await q.enqueueLocalJob("score_row", { n: 1 });
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => q.claimNextJob(`worker-${i}`, [TEXT()])));
    const winners = results.filter((r) => r !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.id).toBe(job.id);

    const row = await jobRow(job.id);
    expect(row).toMatchObject({ status: "claimed", attempts: 1, model: TEXT(), workerId: winners[0]!.workerId });
    expect(row.claimToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("gives five jobs to five workers asking at once, one each", async () => {
    const jobs = await Promise.all(Array.from({ length: 5 }, (_, i) => q.enqueueLocalJob("score_row", { n: i })));
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => q.claimNextJob(`worker-${i}`, [TEXT()])));
    const ids = results.map((r) => r?.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(5);
    expect(new Set(ids)).toEqual(new Set(jobs.map((j) => j.id)));
    expect(await q.claimNextJob("worker-late", [TEXT()])).toBeNull();
  });

  it("hands out the oldest job first", async () => {
    const first = await q.enqueueLocalJob("score_row", { n: 1 }, new Date(Date.now() - 5000));
    await q.enqueueLocalJob("score_row", { n: 2 });
    expect((await q.claimNextJob("w", [TEXT()]))?.id).toBe(first.id);
  });

  it("only hands out jobs whose model the worker has pulled", async () => {
    const job = await q.enqueueLocalJob("transcribe_page", { pageId: randomUUID() });
    expect(await q.claimNextJob("text-only", [TEXT()])).toBeNull();
    expect(await q.claimNextJob("no-models", [])).toBeNull();
    expect((await q.claimNextJob("vision", [VISION()]))?.id).toBe(job.id);
  });

  it("never hands out a job past its deadline or one routed to the cloud", async () => {
    await q.enqueueLocalJob("score_row", { n: 1 });
    expect(await q.claimNextJob("w", [TEXT()], later(env().LLM_LOCAL_TIMEOUT_SECONDS + 1))).toBeNull();
    await db.update(schema.llmJobs).set({ route: "cloud" });
    expect(await q.claimNextJob("w", [TEXT()])).toBeNull();
  });

  it("refuses every action with the wrong claim token", async () => {
    await q.enqueueLocalJob("score_row", { n: 1 });
    const job = (await q.claimNextJob("w", [TEXT()]))!;
    const wrong = randomUUID();
    expect(await q.extendLease(job.id, wrong)).toBe(false);
    expect(await q.completeLocal(job.id, wrong, { output: {}, tokensIn: 1, tokensOut: 1, model: "m" })).toBeNull();
    expect(await q.failLocal(job.id, wrong, "x")).toBe(false);
    expect(await q.releaseLocal(job.id, wrong)).toBe(false);
    expect((await jobRow(job.id)).status).toBe("claimed");
  });

  it("puts a released job back for the next worker, with a new token", async () => {
    await q.enqueueLocalJob("score_row", { n: 1 });
    const first = (await q.claimNextJob("w1", [TEXT()]))!;
    expect(await q.releaseLocal(first.id, first.claimToken!)).toBe(true);
    const second = (await q.claimNextJob("w2", [TEXT()]))!;
    expect(second.id).toBe(first.id);
    expect(second.claimToken).not.toBe(first.claimToken);
    expect(second.attempts).toBe(2);
  });

  it("counts a lease extension as a heartbeat", async () => {
    await q.heartbeat("busy-mac", [TEXT()], "1", new Date(Date.now() - 10 * 60 * 1000));
    expect(await q.workerOnline("score_row")).toBe(false);
    await q.enqueueLocalJob("score_row", { n: 1 });
    const job = (await q.claimNextJob("busy-mac", [TEXT()]))!;
    expect(await q.extendLease(job.id, job.claimToken!)).toBe(true);
    expect(await q.workerOnline("score_row")).toBe(true);
  });
});

describe("choosing where a job runs", () => {
  it("uses the cloud when no worker has checked in recently", async () => {
    expect(await q.chooseRoute("transcribe_page")).toBe("cloud");
    await q.heartbeat("old-mac", [VISION()], "1", new Date(Date.now() - (env().LLM_WORKER_STALE_SECONDS + 5) * 1000));
    expect(await q.chooseRoute("transcribe_page")).toBe("cloud");
    await q.heartbeat("old-mac", [VISION()], "1");
    expect(await q.chooseRoute("transcribe_page")).toBe("local");
  });

  it("uses the cloud when the online worker lacks the model, the route is off, or no token is set", async () => {
    await q.heartbeat("mac", [TEXT()], "1");
    expect(await q.chooseRoute("transcribe_page")).toBe("cloud");
    expect(await q.chooseRoute("score_row")).toBe("local");
    setEnv({ LLM_ROUTE_SCORE: "cloud" });
    expect(await q.chooseRoute("score_row")).toBe("cloud");
    setEnv({ LLM_ROUTE_SCORE: "local", LLM_WORKER_TOKEN: undefined });
    expect(await q.chooseRoute("score_row")).toBe("cloud");
  });

  it("stops queueing for the worker once LLM_LOCAL_MAX_QUEUE jobs are waiting", async () => {
    setEnv({ LLM_LOCAL_MAX_QUEUE: "2" });
    await q.heartbeat("mac", [TEXT()], "1");
    await q.enqueueLocalJob("score_row", { n: 1 });
    expect(await q.chooseRoute("score_row")).toBe("local");
    await q.enqueueLocalJob("score_row", { n: 2 });
    expect(await q.chooseRoute("score_row")).toBe("cloud");
  });

  it("reads a page in the cloud right away when no worker is online, and records the call", async () => {
    const { pageId } = await makePageToRead();
    await transcribePageJob(pageId);
    const page = await db.query.pages.findFirst({ where: eq(schema.pages.id, pageId) });
    expect(page?.status).toBe("transcribed");
    const jobs = await db.select().from(schema.llmJobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ type: "transcribe_page", route: "cloud", provider: "cloud", status: "completed", input: { pageId } });
  });
});

describe("falling back to the cloud", () => {
  it("runs a job nobody claimed by its deadline in the cloud", async () => {
    const { pageId } = await makePageToRead();
    await q.heartbeat("mac", [VISION()], "1");
    await transcribePageJob(pageId);
    await drainInlineJobs();
    const [job] = await db.select().from(schema.llmJobs);
    expect(job).toMatchObject({ route: "local", status: "pending" });

    // Before the deadline the watch waits; after it, the cloud does the job.
    expect(await checkLlmJob(job.id)).toEqual({ done: false, waitUntil: job.deadlineAt });
    expect(await checkLlmJob(job.id, later(env().LLM_LOCAL_TIMEOUT_SECONDS + 1))).toEqual({ done: true });
    expect(await jobRow(job.id)).toMatchObject({ status: "completed", provider: "cloud", route: "cloud", workerId: q.SERVER_WORKER });
    expect((await db.query.pages.findFirst({ where: eq(schema.pages.id, pageId) }))?.status).toBe("transcribed");
  });

  it("runs a job in the cloud when the worker's lease runs out, and refuses the worker's late answer", async () => {
    const { pageId } = await makePageToRead();
    await q.heartbeat("mac", [VISION()], "1");
    await transcribePageJob(pageId);
    const claimed = (await claim([VISION()]))!;
    expect(claimed).toBeTruthy();

    // The Mac went to sleep holding the job.
    expect((await checkLlmJob(claimed.id)).done).toBe(false);
    expect(await checkLlmJob(claimed.id, later(env().LLM_LEASE_SECONDS + 1))).toEqual({ done: true });
    expect(await jobRow(claimed.id)).toMatchObject({ status: "completed", provider: "cloud" });

    const late = await handleJobAction(claimed.id, "complete", { claimToken: claimed.claimToken, json: TRANSCRIPTION, tokensIn: 1000, tokensOut: 200, model: VISION() });
    expect(late.status).toBe(409);
    expect((await handleJobAction(claimed.id, "extend", { claimToken: claimed.claimToken })).status).toBe(409);
  });

  it("does the job in the cloud at once when the worker reports a failure", async () => {
    const { pageId } = await makePageToRead();
    await q.heartbeat("mac", [VISION()], "1");
    await transcribePageJob(pageId);
    const claimed = (await claim([VISION()]))!;
    const res = await handleJobAction(claimed.id, "fail", { claimToken: claimed.claimToken, error: "Ollama ran out of memory." });
    expect(res.status).toBe(200);
    await drainInlineJobs();
    expect(await jobRow(claimed.id)).toMatchObject({ status: "completed", provider: "cloud", error: "Ollama ran out of memory." });
    expect((await db.query.pages.findFirst({ where: eq(schema.pages.id, pageId) }))?.status).toBe("transcribed");
  });

  it("never saves an answer that does not match the schema: the cloud does the job", async () => {
    const { pageId } = await makePageToRead();
    await q.heartbeat("mac", [VISION()], "1");
    await transcribePageJob(pageId);
    const claimed = (await claim([VISION()]))!;
    const res = await handleJobAction(claimed.id, "complete", { claimToken: claimed.claimToken, json: { lines: "nope" }, tokensIn: 10, tokensOut: 10, model: VISION() });
    expect(res.status).toBe(422);
    await drainInlineJobs();
    expect(await jobRow(claimed.id)).toMatchObject({ status: "completed", provider: "cloud" });
  });

  it("cancels a job whose page no longer needs reading when a worker asks for it", async () => {
    const { pageId } = await makePageToRead();
    await q.heartbeat("mac", [VISION()], "1");
    await transcribePageJob(pageId);
    // The teacher detached the page before the worker got to it.
    await db.update(schema.pages).set({ status: "unmatched" }).where(eq(schema.pages.id, pageId));
    expect(await claim([VISION()])).toBeNull();
    const [job] = await db.select().from(schema.llmJobs);
    expect(job.status).toBe("cancelled");
  });
});

describe("the worker round trip", () => {
  it("reads a page on the worker and saves it, with the cloud cost it avoided", async () => {
    const { pageId, submissionId, image } = await makePageToRead();
    expect(await claim([VISION()])).toBeNull(); // first ask: nothing yet, but now the worker is online
    await transcribePageJob(pageId);

    const job = (await claim([VISION()]))!;
    expect(job.type).toBe("transcribe_page");
    expect(job.request.model).toBe(VISION());
    expect(job.request.parts).toContainEqual({ type: "image", mediaType: "image/jpeg", data: image.toString("base64") });
    expect(job.request.jsonSchema).toMatchObject({ type: "object", properties: { lines: { type: "array" } } });
    expect(job.request.jsonSchema).not.toHaveProperty("$schema");

    const res = await handleJobAction(job.id, "complete", { claimToken: job.claimToken, json: TRANSCRIPTION, tokensIn: 1800, tokensOut: 400, model: VISION() });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    await drainInlineJobs();

    const page = await db.query.pages.findFirst({ where: eq(schema.pages.id, pageId) });
    expect(page?.status).toBe("transcribed");
    expect(page?.draftText).toContain("Reformers pushed for abolition");
    expect(page?.transcriptionModel).toBe(VISION());
    const sub = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, submissionId) });
    expect(sub?.status).toBe("needs_confirmation");

    const row = await jobRow(job.id);
    expect(row).toMatchObject({ status: "completed", provider: "local", tokensIn: 1800, tokensOut: 400, costUsd: "0.000000" });
    expect(Number(row.cloudCostEstimateUsd)).toBeGreaterThan(0);
    // Once saved on the page, the answer is not kept in the queue.
    expect(row.output).toBeNull();
  });

  it("scores every row on the worker, retries a row with banned wording once, and closes the run", async () => {
    const { roster, assignment, rubric } = await makeAssignment();
    const essay = "Maya Jackson. Reform movements expanded democracy for some Americans. Seneca Falls demanded the vote and abolitionists attacked slavery.";
    const [sub] = await db
      .insert(schema.submissions)
      .values({ assignmentId: assignment.id, studentId: roster[0].id, inputKind: "typed", typedText: essay, status: "scoring" })
      .returning();
    await q.heartbeat("mac", [TEXT()], "1");
    await scoreSubmission(sub.id);

    const run = (await db.query.scoreRuns.findFirst({ where: eq(schema.scoreRuns.submissionId, sub.id) }))!;
    expect(run).toMatchObject({ status: "running", model: TEXT() });
    expect(await db.$count(schema.llmJobs, eq(schema.llmJobs.route, "local"))).toBe(rubric.rows.length);

    const banned = "Great job!";
    expect(feedbackViolations(banned).length).toBeGreaterThan(0);
    const answer = (feedback: string) => ({
      points: 1,
      justification: "The essay names Seneca Falls as a push for the vote.",
      evidence_quotes: ["Seneca Falls demanded the vote"],
      student_feedback: feedback,
      confidence: 0.9,
      borderline: false,
    });

    let first = true;
    for (;;) {
      const job = await claim([TEXT()]);
      if (!job) break;
      const context = job.request.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n");
      expect(context).not.toMatch(/Maya|Jackson/);
      expect(context).toContain("Seneca Falls");
      const feedback = first ? banned : "Name which Americans gained and which did not, and quote a document for each.";
      first = false;
      const res = await handleJobAction(job.id, "complete", { claimToken: job.claimToken, json: answer(feedback), tokensIn: 3000, tokensOut: 300, model: TEXT() });
      expect(res.status).toBe(200);
      await drainInlineJobs();
    }

    // One row was asked again with the problem named.
    const retries = await db.select().from(schema.llmJobs).where(sql`${schema.llmJobs.input}->>'attempt' = '2'`);
    expect(retries).toHaveLength(1);
    expect(String(retries[0].input.retryNote)).toContain("banned wording");

    const rows = await db.query.rowScores.findMany({ where: eq(schema.rowScores.scoreRunId, run.id) });
    expect(rows).toHaveLength(rubric.rows.length);
    expect(rows.every((r) => r.points === 1 && r.evidence[0]?.verified)).toBe(true);
    expect(rows.some((r) => r.studentFeedback === banned)).toBe(false);

    const closed = (await db.query.scoreRuns.findFirst({ where: eq(schema.scoreRuns.id, run.id) }))!;
    expect(closed.status).toBe("completed");
    expect(closed.inputTokens).toBe(3000 * (rubric.rows.length + 1));
    expect(Number(closed.costUsd)).toBe(0);
    expect((await db.query.submissions.findFirst({ where: eq(schema.submissions.id, sub.id) }))?.status).toBe("scored");
  });
});

describe("worker endpoints", () => {
  const post = (url: string, body: unknown, token?: string) =>
    new Request(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const claimBody = { workerId: "mac", models: [TEXT()] };

  it("refuses requests without the right token", async () => {
    expect((await claimRoute.POST(post("http://localhost/api/llm-worker/claim", claimBody))).status).toBe(401);
    expect((await claimRoute.POST(post("http://localhost/api/llm-worker/claim", claimBody, `${TOKEN}x`))).status).toBe(401);
    const params = Promise.resolve({ id: randomUUID(), action: "complete" });
    expect((await actionRoute.POST(post("http://localhost/x", {}), { params })).status).toBe(401);
  });

  it("refuses everyone when no worker token is configured", async () => {
    setEnv({ LLM_WORKER_TOKEN: undefined });
    expect((await claimRoute.POST(post("http://localhost/api/llm-worker/claim", claimBody, TOKEN))).status).toBe(401);
  });

  it("answers a good request and rejects a malformed one", async () => {
    const ok = await claimRoute.POST(post("http://localhost/api/llm-worker/claim", claimBody, TOKEN));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ job: null });
    expect((await claimRoute.POST(post("http://localhost/api/llm-worker/claim", { models: "all" }, TOKEN))).status).toBe(400);
    const params = Promise.resolve({ id: randomUUID(), action: "extend" });
    expect((await actionRoute.POST(post("http://localhost/x", { claimToken: randomUUID() }, TOKEN), { params })).status).toBe(409);
  });
});

describe("savings", () => {
  it("adds up local jobs, cloud spend and the cloud cost avoided, by month", async () => {
    const base = { type: "score_row" as const, input: {}, status: "completed" as const };
    await db.insert(schema.llmJobs).values([
      { ...base, route: "local", provider: "local", tokensIn: 1000, tokensOut: 100, costUsd: "0", cloudCostEstimateUsd: "0.500000", completedAt: new Date("2026-10-03T12:00:00Z") },
      { ...base, route: "local", provider: "local", tokensIn: 2000, tokensOut: 200, costUsd: "0", cloudCostEstimateUsd: "0.250000", completedAt: new Date("2026-10-20T12:00:00Z") },
      { ...base, route: "cloud", provider: "cloud", tokensIn: 500, tokensOut: 50, costUsd: "0.100000", completedAt: new Date("2026-10-21T12:00:00Z") },
      { ...base, route: "cloud", provider: "cloud", tokensIn: 500, tokensOut: 50, costUsd: "0.300000", completedAt: new Date("2026-11-02T12:00:00Z") },
      // Failed and unfinished jobs do not count.
      { ...base, route: "cloud", provider: "cloud", status: "failed", costUsd: "9", completedAt: new Date("2026-11-02T12:00:00Z") },
      { ...base, route: "local", status: "pending" },
    ]);
    const months = await monthlySavings();
    expect(months).toEqual([
      { month: "2026-11", localJobs: 0, cloudJobs: 1, localTokensIn: 0, localTokensOut: 0, cloudSpendUsd: 0.3, savedUsd: 0 },
      { month: "2026-10", localJobs: 2, cloudJobs: 1, localTokensIn: 3000, localTokensOut: 300, cloudSpendUsd: 0.1, savedUsd: 0.75 },
    ]);
    expect(await db.$count(schema.llmJobs, and(eq(schema.llmJobs.status, "completed")))).toBe(4);
  });
});
