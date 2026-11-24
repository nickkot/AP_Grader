/**
 * Phone upload links against the test database: a link only works for its own
 * assignment, only for PHONE_LINK_HOURS, and only with its own upload batches.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resetTestDb } from "../support/db";

const { db } = await import("@/lib/db");
const schema = await import("@/lib/db/schema");
const { drainInlineJobs } = await import("@/lib/jobs");
const { putObject } = await import("@/lib/storage");
const { createPhoneLink, findPhoneLink, hashPhoneToken, PHONE_LINK_HOURS } = await import("@/lib/phone-links");
const { createPhotoBatch } = await import("@/lib/uploads");
const { startPhoneBatch, presignPhonePhoto, registerPhonePhoto, phoneBatchProgress } = await import("@/lib/actions/phone-uploads");
const { rubricForEssayType } = await import("@/lib/rubrics");

const rubric = rubricForEssayType("APUSH_DBQ");

async function setup() {
  const teacherId = randomUUID();
  await db.insert(schema.user).values({ id: teacherId, name: "Test Teacher", email: `${teacherId}@example.com` });
  const [cls] = await db.insert(schema.classes).values({ teacherId, course: "APUSH", name: "Period 2" }).returning();
  const [assignment] = await db
    .insert(schema.assignments)
    .values({
      teacherId,
      classId: cls.id,
      essayType: "APUSH_DBQ",
      title: "Reform DBQ",
      promptText: "Evaluate reform movements.",
      timeLimitMinutes: 60,
      rubricKey: rubric.key,
      rubricVersion: rubric.version,
    })
    .returning();
  return { teacherId, assignment };
}

const blankPage = () => sharp({ create: { width: 600, height: 800, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();

describe("phone upload links", () => {
  beforeAll(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await drainInlineJobs();
  });

  it("finds a link by its token and stores only a hash", async () => {
    const { teacherId, assignment } = await setup();
    const { token, expiresAt } = await createPhoneLink(assignment.id, teacherId);

    const link = await findPhoneLink(token);
    expect(link?.assignmentId).toBe(assignment.id);
    expect(link?.className).toBe("Period 2");

    const stored = await db.query.phoneLinks.findFirst({ where: eq(schema.phoneLinks.assignmentId, assignment.id) });
    expect(stored?.tokenHash).toBe(hashPhoneToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan((PHONE_LINK_HOURS * 60 - 1) * 60 * 1000);
  });

  it("refuses wrong, malformed and expired tokens", async () => {
    const { teacherId, assignment } = await setup();
    const { token } = await createPhoneLink(assignment.id, teacherId);

    expect(await findPhoneLink(token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(await findPhoneLink("short")).toBeNull();
    expect(await findPhoneLink("../../etc/passwd")).toBeNull();
    const later = new Date(Date.now() + (PHONE_LINK_HOURS * 60 + 1) * 60 * 1000);
    expect(await findPhoneLink(token, later)).toBeNull();

    const expired = await createPhoneLink(assignment.id, teacherId, new Date(Date.now() - (PHONE_LINK_HOURS + 1) * 60 * 60 * 1000));
    expect(await startPhoneBatch(expired.token)).toEqual({ error: expect.stringContaining("expired") });
    expect(await presignPhonePhoto(expired.token, "image/jpeg")).toEqual({ error: expect.stringContaining("expired") });
  });

  it("uploads a photo to its own assignment and nowhere else", async () => {
    const { teacherId, assignment } = await setup();
    const other = await setup();
    const { token } = await createPhoneLink(assignment.id, teacherId);

    const batch = await startPhoneBatch(token);
    if ("error" in batch) throw new Error(batch.error);
    const signed = await presignPhonePhoto(token, "image/jpeg");
    if ("error" in signed) throw new Error(signed.error);
    expect(signed.key.startsWith(`assignments/${assignment.id}/pages/`)).toBe(true);

    const image = await blankPage();
    await putObject(signed.key, image, "image/jpeg");
    const photo = { batchId: batch.batchId, pageId: signed.pageId, key: signed.key, contentType: "image/jpeg", sizeBytes: image.length };
    expect(await registerPhonePhoto(token, photo)).toEqual({ ok: true });
    await drainInlineJobs();

    const page = await db.query.pages.findFirst({ where: eq(schema.pages.id, signed.pageId) });
    expect(page?.assignmentId).toBe(assignment.id);
    expect(page?.uploadedBy).toBe(teacherId);

    const progress = await phoneBatchProgress(token, batch.batchId);
    expect(progress).toMatchObject({ total: 1 });

    // A key for another assignment is refused.
    const foreignKey = `assignments/${other.assignment.id}/pages/${signed.pageId}.jpg`;
    await expect(registerPhonePhoto(token, { ...photo, key: foreignKey })).rejects.toThrow("Invalid upload.");

    // So is a batch the link did not create, even on the same assignment.
    const teacherBatch = await createPhotoBatch(assignment.id, teacherId);
    await expect(registerPhonePhoto(token, { ...photo, pageId: randomUUID(), batchId: teacherBatch.batchId })).rejects.toThrow("Invalid upload.");
    expect(await phoneBatchProgress(token, teacherBatch.batchId)).toEqual({ error: "Upload not found." });
  });
});
