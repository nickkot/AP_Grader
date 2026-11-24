/**
 * End-to-end pipeline against the test database, with fake models:
 * print a packet, photograph a page (upside down), read its QR code, transcribe,
 * confirm, score, and check that no student name reaches the scoring model.
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { and, eq } from "drizzle-orm";
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
const { processPage, scoreSubmission, attachPage } = await import("@/lib/pipeline/run");
const { splitPdfToImages } = await import("@/lib/pipeline/images");
const { renderPacketPdf } = await import("@/lib/packet/render");
const { orderSheets } = await import("@/lib/packet/order");
const { ensurePacketTokens } = await import("@/lib/packet/tokens");
const { putObject } = await import("@/lib/storage");
const { DEMO_DBQ } = await import("@/lib/demo/content");
const { rubricForEssayType } = await import("@/lib/rubrics");

const rubric = rubricForEssayType("APUSH_DBQ");

async function setup() {
  const teacherId = randomUUID();
  await db.insert(schema.user).values({ id: teacherId, name: "Test Teacher", email: `${teacherId}@example.com` });
  const [cls] = await db.insert(schema.classes).values({ teacherId, course: "APUSH", name: "Period 1" }).returning();
  const roster = await db
    .insert(schema.students)
    .values([
      { classId: cls.id, teacherId, firstName: "Maya", lastName: "Jackson" },
      { classId: cls.id, teacherId, firstName: "Daniel", lastName: "Reyes" },
    ])
    .returning();
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
  return { teacherId, cls, roster, assignment };
}

async function uploadImage(assignmentId: string, teacherId: string, image: Buffer) {
  const id = randomUUID();
  const key = `assignments/${assignmentId}/pages/${id}.jpg`;
  await putObject(key, image, "image/jpeg");
  await db.insert(schema.pages).values({
    id,
    assignmentId,
    originalKey: key,
    contentType: "image/jpeg",
    sizeBytes: image.length,
    sha256: "pending",
    uploadedBy: teacherId,
  });
  return id;
}

describe("handwritten pipeline", () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  it("matches a photographed answer sheet by QR, transcribes, scores and keeps names out of the model", async () => {
    const { teacherId, roster, assignment } = await setup();
    const maya = roster[0];

    // Print a packet and take Maya's first answer sheet.
    const { studentTokens, spareTokens } = await ensurePacketTokens({
      assignmentId: assignment.id,
      studentIds: roster.map((s) => s.id),
      pagesPerStudent: 2,
      spareSets: 1,
    });
    const sheets = orderSheets({
      students: roster.map((s, i) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, rosterIndex: i })),
      tokens: [...studentTokens, ...spareTokens],
      order: "roster",
      pagesPerStudent: 2,
    });
    const pdf = await renderPacketPdf({
      appUrl: "http://localhost:3000",
      className: "Period 1",
      courseLabel: "AP U.S. History",
      assignmentTitle: assignment.title,
      essayTypeLabel: "Document-based question",
      promptText: assignment.promptText,
      sources: assignment.sources,
      timeLimitMinutes: 60,
      readingMinutes: 15,
      rubricRows: rubric.rows,
      sheets,
      paperSize: "LETTER",
      doubleSided: false,
    });
    const images = await splitPdfToImages(pdf, { dpi: 150 });
    const answerStart = images.length - sheets.length;
    const mayaPage1 = images[answerStart + sheets.findIndex((s) => s.studentName?.startsWith("Maya") && s.pageNumber === 1)];

    // Photographed upside down.
    const upsideDown = await sharp(mayaPage1).rotate(180).jpeg().toBuffer();
    const pageId = await uploadImage(assignment.id, teacherId, upsideDown);
    await processPage(pageId);
    await drainInlineJobs();

    const page = await db.query.pages.findFirst({ where: eq(schema.pages.id, pageId) });
    expect(page?.matchMethod).toBe("qr");
    expect(page?.pageNumber).toBe(1);
    expect(page?.status).toBe("transcribed");
    expect(page?.sha256).toMatch(/^[0-9a-f]{64}$/);

    const sub = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, page!.submissionId!) });
    expect(sub?.studentId).toBe(maya.id);
    expect(sub?.status).toBe("needs_confirmation");

    // Teacher corrects the transcription, adding the student's name the way students sometimes do, then confirms.
    await db
      .update(schema.pages)
      .set({ confirmedText: `Maya Jackson\n${page!.draftText}\nMy name is Maya and Daniel Reyes helped me study. Jackson vetoed the bank.` })
      .where(eq(schema.pages.id, pageId));
    await db.update(schema.submissions).set({ status: "scoring" }).where(eq(schema.submissions.id, sub!.id));
    await scoreSubmission(sub!.id);

    const scored = await db.query.submissions.findFirst({ where: eq(schema.submissions.id, sub!.id) });
    expect(scored?.status).toBe("scored");
    const rows = await db.query.rowScores.findMany({ where: eq(schema.rowScores.submissionId, sub!.id) });
    expect(rows.map((r) => r.rowKey).sort()).toEqual(rubric.rows.map((r) => r.key).sort());
    for (const r of rows) {
      expect(r.points).not.toBeNull();
      expect(r.points!).toBeLessThanOrEqual(r.maxPoints);
      expect(r.evidence.length).toBeGreaterThan(0);
      expect(r.evidence.every((e) => e.verified)).toBe(true);
      expect(r.evidence[0].pageNumber).toBe(1);
    }

    const run = await db.query.scoreRuns.findFirst({ where: eq(schema.scoreRuns.submissionId, sub!.id) });
    expect(run).toMatchObject({ rubricKey: "apush-dbq", rubricVersion: 1, promptVersion: "score-v1", status: "completed" });

    // No student name reaches the model; the historical "Jackson vetoed" does.
    expect(contextsSentToModel.length).toBe(rubric.rows.length);
    for (const block of contextsSentToModel) {
      expect(block).not.toMatch(/Maya|Daniel|Reyes/);
      expect(block).toContain("Jackson vetoed");
    }
  });

  it("sends pages without a known QR code to the match screen, then attaches them by hand", async () => {
    const { teacherId, roster, assignment } = await setup();
    const blank = await sharp({ create: { width: 1200, height: 1550, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
    const pageId = await uploadImage(assignment.id, teacherId, blank);
    await processPage(pageId);
    let page = await db.query.pages.findFirst({ where: eq(schema.pages.id, pageId) });
    expect(page?.status).toBe("unmatched");
    expect(page?.error).toMatch(/No QR code/);

    await attachPage(pageId, roster[1].id, 2, "manual");
    await drainInlineJobs();
    page = await db.query.pages.findFirst({ where: eq(schema.pages.id, pageId) });
    expect(page).toMatchObject({ status: "transcribed", matchMethod: "manual", pageNumber: 2 });
    const sub = await db.query.submissions.findFirst({
      where: and(eq(schema.submissions.assignmentId, assignment.id), eq(schema.submissions.studentId, roster[1].id)),
    });
    expect(sub?.status).toBe("needs_confirmation");
  });

  it("does not score a submission that was cancelled", async () => {
    const { roster, assignment } = await setup();
    const [sub] = await db
      .insert(schema.submissions)
      .values({ assignmentId: assignment.id, studentId: roster[0].id, inputKind: "typed", typedText: "A typed essay with enough words to score here.", status: "needs_confirmation" })
      .returning();
    await scoreSubmission(sub.id);
    const runs = await db.query.scoreRuns.findMany({ where: eq(schema.scoreRuns.submissionId, sub.id) });
    expect(runs).toHaveLength(0);
  });
});
