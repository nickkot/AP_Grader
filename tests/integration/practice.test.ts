/**
 * Student practice against the test database with fake models: joining a class by code,
 * writing with autosave and deadlines, scoring through the same pipeline, and keeping
 * practice essays private to the student who wrote them.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { resetTestDb } from "../support/db";

const contextsSentToModel: string[] = [];
vi.mock("@/lib/ai/score", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/ai/score")>();
  return {
    ...mod,
    scoreRow: (ctx: Parameters<typeof mod.scoreRow>[0], block: string, row: Parameters<typeof mod.scoreRow>[2]) => {
      contextsSentToModel.push(block);
      return mod.scoreRow(ctx, block, row);
    },
  };
});

const { db } = await import("@/lib/db");
const schema = await import("@/lib/db/schema");
const { drainInlineJobs } = await import("@/lib/jobs");
const { audit, getSubmissionForTeacher } = await import("@/lib/data");
const { claimSeat, ensureJoinCode, failedJoinsInLastHour, findClassByCode } = await import("@/lib/join");
const practice = await import("@/lib/practice/attempts");
const { SUBMIT_GRACE_MS } = await import("@/lib/practice/timing");
const { numberedStudents } = await import("@/lib/rosters");
const { rubricForEssayType } = await import("@/lib/rubrics");

async function makeUser(kind: "teacher" | "student", name = "Test Person") {
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name, email: `${id}@example.com`, kind });
  return id;
}

async function makeClass(rosterKind: "names" | "numbers" = "names") {
  const teacherId = await makeUser("teacher", "Test Teacher");
  const [cls] = await db.insert(schema.classes).values({ teacherId, course: "APUSH", name: "Period 7", rosterKind }).returning();
  if (rosterKind === "numbers") {
    await db.insert(schema.students).values(numberedStudents(cls.id, teacherId, 1, 3));
  } else {
    await db.insert(schema.students).values([
      { classId: cls.id, teacherId, firstName: "José", lastName: "O'Neil" },
      { classId: cls.id, teacherId, firstName: "Maya", lastName: "Chen" },
    ]);
  }
  return { teacherId, cls, code: await ensureJoinCode(cls.id) };
}

const ESSAY =
  "My name is Ana Ruiz. Reform movements expanded democratic ideals for some Americans. The women at Seneca Falls demanded the vote, and abolitionists attacked slavery as a betrayal of equality. Other reformers wanted order more than democracy.";

describe("joining a class", () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  it("finds a class by code in any case and spacing, and keeps the code stable", async () => {
    const { cls, code } = await makeClass();
    expect(code).toMatch(/^[23456789A-HJ-NP-Z]{6}$/);
    expect(await ensureJoinCode(cls.id)).toBe(code);
    expect((await findClassByCode(` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `))?.id).toBe(cls.id);
    expect(await findClassByCode("ZZZZZZ")).toBeNull();
  });

  it("matches a name regardless of case, accents and punctuation, once", async () => {
    const { cls } = await makeClass();
    const first = await makeUser("student");
    const second = await makeUser("student");

    expect(await claimSeat(first, cls.id, { firstName: "jose", lastName: "oneil" })).toMatchObject({ ok: true });
    expect(await claimSeat(second, cls.id, { firstName: "José", lastName: "O'Neil" })).toEqual({ error: expect.stringContaining("already joined") });
    expect(await claimSeat(second, cls.id, { firstName: "Nobody", lastName: "Here" })).toEqual({ error: expect.stringContaining("not on the Period 7 roster") });
    // Joining again is harmless.
    expect(await claimSeat(first, cls.id, { firstName: "jose", lastName: "oneil" })).toMatchObject({ ok: true, alreadyJoined: true });
  });

  it("joins a numbered class by number", async () => {
    const { cls } = await makeClass("numbers");
    const student = await makeUser("student");
    expect(await claimSeat(student, cls.id, { number: 9 })).toEqual({ error: expect.stringContaining("number is not on") });
    expect(await claimSeat(student, cls.id, { number: 2 })).toMatchObject({ ok: true });
    const membership = await db.query.classMemberships.findFirst({ where: eq(schema.classMemberships.userId, student) });
    const seat = await db.query.students.findFirst({ where: eq(schema.students.id, membership!.studentId!) });
    expect(seat?.number).toBe(2);
  });

  it("counts failed tries in the last hour", async () => {
    const student = await makeUser("student");
    for (let i = 0; i < 3; i++) await audit(student, "class.join_failed", "class", null);
    expect(await failedJoinsInLastHour(student)).toBe(3);
  });
});

describe("practice essays", () => {
  it("starts a timed DBQ with a reading period, and resumes the open attempt", async () => {
    const student = await makeUser("student");
    const now = new Date("2026-11-24T15:00:00Z");
    const started = await practice.startAttempt(student, "dbq-reform-1820-1860", "timed", now);
    if ("error" in started) throw new Error(started.error);
    expect(started.attempt.readingEndsAt?.toISOString()).toBe("2026-11-24T15:15:00.000Z");
    expect(started.attempt.deadlineAt?.toISOString()).toBe("2026-11-24T16:00:00.000Z");

    const again = await practice.startAttempt(student, "dbq-reform-1820-1860", "timed", new Date("2026-11-24T15:10:00Z"));
    if ("error" in again) throw new Error(again.error);
    expect(again.attempt.id).toBe(started.attempt.id);
    expect(await practice.startAttempt(student, "no-such-prompt", "timed")).toEqual({ error: expect.any(String) });
  });

  it("keeps the newest autosave and refuses saves after time is up", async () => {
    const student = await makeUser("student");
    const now = new Date();
    const started = await practice.startAttempt(student, "lang-boredom", "timed", now);
    if ("error" in started) throw new Error(started.error);
    const id = started.attempt.id;

    await practice.saveDraft(student, id, "second draft", 2, now);
    expect(await practice.saveDraft(student, id, "first draft", 1, now)).toMatchObject({ stale: true });
    expect((await practice.getAttempt(student, id))?.draftText).toBe("second draft");

    const late = new Date(started.attempt.deadlineAt!.getTime() + SUBMIT_GRACE_MS + 1000);
    expect(await practice.saveDraft(student, id, "too late", 3, late)).toEqual({ error: "Time is up." });
  });

  it("scores only the saved draft when the essay arrives after the deadline", async () => {
    const student = await makeUser("student", "Ana Ruiz");
    const start = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const started = await practice.startAttempt(student, "lang-boredom", "timed", start);
    if ("error" in started) throw new Error(started.error);
    await practice.saveDraft(student, started.attempt.id, ESSAY, 1, start);

    expect(await practice.submitAttempt(student, started.attempt.id, `${ESSAY} Words typed after time ran out.`, false)).toEqual({ ok: true });
    const attempt = await practice.getAttempt(student, started.attempt.id);
    expect(attempt?.autoSubmitted).toBe(true);
    expect(attempt?.draftText).toBe(ESSAY);
    await drainInlineJobs();
  });

  it("scores a practice essay through the pipeline, privately, without the student's name", async () => {
    const student = await makeUser("student", "Ana Ruiz");
    const other = await makeUser("student");
    const { teacherId } = await makeClass();
    const started = await practice.startAttempt(student, "dbq-reform-1820-1860", "untimed");
    if ("error" in started) throw new Error(started.error);

    expect(await practice.submitAttempt(student, started.attempt.id, "Too short.", false)).toEqual({ error: expect.stringContaining("few sentences") });
    contextsSentToModel.length = 0;
    expect(await practice.submitAttempt(student, started.attempt.id, ESSAY, false)).toEqual({ ok: true });
    await drainInlineJobs();

    const attempt = (await practice.getAttempt(student, started.attempt.id))!;
    const result = await practice.attemptResult(attempt);
    expect(result?.status).toBe("scored");
    expect(result?.rows.map((r) => r.key)).toEqual(rubricForEssayType("APUSH_DBQ").rows.map((r) => r.key));
    expect(result?.maxTotal).toBe(7);
    expect(result?.rows.every((r) => r.points !== null && r.feedback)).toBe(true);

    // The student's own name never reaches the model.
    expect(contextsSentToModel.length).toBeGreaterThan(0);
    expect(contextsSentToModel.join("\n")).not.toContain("Ruiz");

    // Other students and teachers cannot open it.
    expect(await practice.getAttempt(other, started.attempt.id)).toBeNull();
    expect(await practice.saveDraft(other, started.attempt.id, "x", 99)).toEqual({ error: "Essay not found." });
    const sub = await db.query.submissions.findFirst({ where: eq(schema.submissions.practiceAttemptId, started.attempt.id) });
    expect(sub?.context).toBe("practice");
    await expect(getSubmissionForTeacher(sub!.id, teacherId)).rejects.toThrow();

    const history = await practice.practiceHistory(student);
    expect(history[0]).toMatchObject({ id: started.attempt.id, status: "scored", maxTotal: 7 });
  });

  it("caps scored essays per day", async () => {
    const student = await makeUser("student");
    const now = new Date();
    for (let i = 0; i < practice.DAILY_PRACTICE_LIMIT; i++) {
      await db.insert(schema.practiceAttempts).values({ userId: student, promptKey: "lang-boredom", promptVersion: 1, mode: "untimed", submittedAt: now });
    }
    const started = await practice.startAttempt(student, "lang-traditions", "untimed", now);
    if ("error" in started) throw new Error(started.error);
    expect(await practice.submitAttempt(student, started.attempt.id, ESSAY, false, now)).toEqual({ error: expect.stringContaining("tomorrow") });
  });
});
