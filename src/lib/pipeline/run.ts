import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { findQuote, joinPages, pageForOffset, type PageSpan } from "@/lib/ai/quotes";
import { redactText } from "@/lib/ai/redact";
import { buildContextBlock, SCORING_PROMPT_VERSION, scoreRow, type RowOutput, type ScoringContext } from "@/lib/ai/score";
import { transcribePage, type TranscriptionResult } from "@/lib/ai/transcribe";
import { db } from "@/lib/db";
import {
  assignments,
  classes,
  llmJobs,
  pages,
  practiceAttempts,
  qrTokens,
  rowScores,
  scoreRuns,
  students,
  submissions,
  uploadBatches,
  user,
  type Evidence,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs";
import { blankTopFallback, processPagePhoto, splitPdfToImages } from "@/lib/pipeline/images";
import { chooseRoute, enqueueLocalJob, localModelFor, recordCloudCall } from "@/lib/llm-queue/jobs";
import { practicePrompt } from "@/lib/practice/prompts";
import { COURSES, ESSAY_TYPES, getRubric, rubricForEssayType, type Rubric, type RubricRow } from "@/lib/rubrics";
import { getObject, putObject } from "@/lib/storage";

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ level: "info", msg, ...extra }));

/** Extract the opaque token from a scanned QR payload like https://app.example.com/q/ABC123. */
export function tokenFromQr(text: string): string | null {
  const m = text.trim().match(/\/q\/([A-Za-z0-9_-]{6,40})\/?$/);
  return m ? m[1] : null;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

/**
 * Clean up an uploaded page, read its QR code, and attach it to the right student.
 * Idempotent: safe to run again on the same page.
 */
export async function processPage(pageId: string): Promise<void> {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page || page.status === "transcribed" || page.status === "transcribing") return;
  await db.update(pages).set({ status: "processing", error: null }).where(eq(pages.id, pageId));

  try {
    const original = await getObject(page.originalKey);
    const sha256 = createHash("sha256").update(original).digest("hex");
    const processed = await processPagePhoto(original);
    let image = processed.image;
    if (!processed.qr) image = await blankTopFallback(image);
    const processedKey = `assignments/${page.assignmentId}/processed/${page.id}.jpg`;
    await putObject(processedKey, image, "image/jpeg");

    const base = { processedKey, sha256, sizeBytes: original.length, width: processed.width, height: processed.height };
    const token = processed.qr ? tokenFromQr(processed.qr.text) : null;
    const qr = token
      ? await db.query.qrTokens.findFirst({ where: eq(qrTokens.token, token) })
      : undefined;

    if (!qr || qr.assignmentId !== page.assignmentId) {
      const error = !processed.qr
        ? "No QR code found. Match this page by hand."
        : !qr
          ? "The QR code is not from this app. Match this page by hand."
          : "This page belongs to a different assignment.";
      await db.update(pages).set({ ...base, status: "unmatched", qrToken: token, error }).where(eq(pages.id, pageId));
      return;
    }

    if (!qr.studentId) {
      // Spare sheet: the student wrote their name, so the teacher matches it.
      await db
        .update(pages)
        .set({ ...base, status: "unmatched", qrToken: token, pageNumber: qr.pageNumber, error: "Spare sheet. Pick the student." })
        .where(eq(pages.id, pageId));
      return;
    }

    await attachPage(pageId, qr.studentId, qr.pageNumber, "qr", { ...base, qrToken: token });
  } catch (err) {
    log("page processing failed", { pageId, err: String(err) });
    await db
      .update(pages)
      .set({ status: "failed", error: "This photo could not be processed. Retake it or upload it again." })
      .where(eq(pages.id, pageId));
    throw err;
  }
}

/**
 * Attach a page to a student's submission and queue transcription.
 * A newer photo of the same page replaces the older one.
 */
export async function attachPage(
  pageId: string,
  studentId: string,
  pageNumber: number,
  matchMethod: "qr" | "manual",
  extra: Partial<typeof pages.$inferInsert> = {},
): Promise<void> {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page) return;

  const submissionId = await ensureSubmission(page.assignmentId, studentId, "handwritten");

  await db
    .update(pages)
    .set({ submissionId: null, status: "failed", error: "Replaced by a newer photo of this page." })
    .where(
      and(
        eq(pages.submissionId, submissionId),
        eq(pages.pageNumber, pageNumber),
        ne(pages.id, pageId),
      ),
    );

  await db
    .update(pages)
    .set({ ...extra, submissionId, pageNumber, matchMethod, status: "transcribing", error: null })
    .where(eq(pages.id, pageId));

  // New pages reopen a submission that was waiting for confirmation.
  await db
    .update(submissions)
    .set({ status: "transcribing", confirmedAt: null, confirmedBy: null })
    .where(and(eq(submissions.id, submissionId), inArray(submissions.status, ["needs_confirmation", "failed"])));

  await enqueue({ name: "page/transcribe", data: { pageId } });
}

export async function ensureSubmission(
  assignmentId: string,
  studentId: string,
  inputKind: "handwritten" | "typed",
): Promise<string> {
  const existing = await db.query.submissions.findFirst({
    where: and(eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, studentId)),
  });
  if (existing) return existing.id;
  const [row] = await db
    .insert(submissions)
    .values({ assignmentId, studentId, inputKind, status: inputKind === "typed" ? "needs_confirmation" : "transcribing" })
    .onConflictDoNothing()
    .returning({ id: submissions.id });
  if (row) return row.id;
  const again = await db.query.submissions.findFirst({
    where: and(eq(submissions.assignmentId, assignmentId), eq(submissions.studentId, studentId)),
  });
  return again!.id;
}

/**
 * Transcribe one page. Queued for a worker on the teacher's own computer when that route
 * is on and a worker is online; otherwise read here, in the cloud, right away.
 */
export async function transcribePageJob(pageId: string): Promise<void> {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page || page.status !== "transcribing" || !page.processedKey) return;
  if ((await chooseRoute("transcribe_page")) === "local") {
    await enqueueLocalJob("transcribe_page", { pageId });
    return;
  }
  const result = await transcribePageCloud(pageId);
  await recordCloudCall("transcribe_page", { pageId }, result ? { model: result.model, usage: result.usage } : { error: "Transcription failed." });
}

/** Read one page with this server's provider and save it. Null when the page is gone or could not be read. */
export async function transcribePageCloud(pageId: string): Promise<TranscriptionResult | null> {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page || page.status !== "transcribing" || !page.processedKey) return null;
  try {
    const image = await getObject(page.processedKey);
    const result = await transcribePage(image, "image/jpeg");
    await savePageTranscription(pageId, result);
    return result;
  } catch (err) {
    log("transcription failed", { pageId, err: String(err) });
    await markPageUnreadable(pageId);
    return null;
  } finally {
    if (page.submissionId) await refreshSubmissionStatus(page.submissionId);
  }
}

/** Store a transcription, unless the page was replaced while it was being read. */
export async function savePageTranscription(pageId: string, result: TranscriptionResult) {
  await db
    .update(pages)
    .set({
      status: "transcribed",
      transcript: result.lines,
      draftText: result.text,
      confirmedText: null,
      meanConfidence: result.meanConfidence,
      lowConfidenceCount: result.lowConfidenceCount,
      transcriptionModel: result.model,
      transcriptionPromptVersion: result.promptVersion,
      transcribedAt: new Date(),
      error: null,
    })
    .where(and(eq(pages.id, pageId), eq(pages.status, "transcribing")));
  log("page transcribed", { pageId, model: result.model, costUsd: result.usage.costUsd, retried: result.retried });
}

export async function markPageUnreadable(pageId: string) {
  await db
    .update(pages)
    .set({ status: "failed", error: "This page could not be read. Retake the photo in better light." })
    .where(and(eq(pages.id, pageId), eq(pages.status, "transcribing")));
}

/** Move a handwritten submission to "needs confirmation" once every page has been transcribed. */
export async function refreshSubmissionStatus(submissionId: string): Promise<void> {
  const sub = await db.query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
  if (!sub || sub.status !== "transcribing") return;
  const subPages = await db.query.pages.findMany({ where: eq(pages.submissionId, submissionId) });
  if (subPages.length === 0) return;
  if (subPages.some((p) => p.status === "transcribing" || p.status === "processing" || p.status === "uploaded")) return;
  const anyReadable = subPages.some((p) => p.status === "transcribed");
  await db
    .update(submissions)
    .set(
      anyReadable
        ? { status: "needs_confirmation", error: null }
        : { status: "failed", error: "No page could be read. Retake the photos." },
    )
    .where(and(eq(submissions.id, submissionId), eq(submissions.status, "transcribing")));
}

/** Split a copier PDF into page images and process each one. */
export async function splitPdfBatch(batchId: string): Promise<void> {
  const batch = await db.query.uploadBatches.findFirst({ where: eq(uploadBatches.id, batchId) });
  if (!batch || batch.status !== "processing" || !batch.pdfKey) return;
  try {
    const pdf = await getObject(batch.pdfKey);
    const images = await splitPdfToImages(pdf, { dpi: 170, maxPages: 800 });
    const ids: string[] = [];
    for (const image of images) {
      const id = randomUUID();
      const key = `assignments/${batch.assignmentId}/pages/${id}.jpg`;
      await putObject(key, image, "image/jpeg");
      ids.push(id);
      await db.insert(pages).values({
        id,
        assignmentId: batch.assignmentId,
        uploadBatchId: batch.id,
        originalKey: key,
        contentType: "image/jpeg",
        sizeBytes: image.length,
        sha256: createHash("sha256").update(image).digest("hex"),
        uploadedBy: batch.uploadedBy,
        status: "uploaded",
      });
    }
    await db.update(uploadBatches).set({ status: "done" }).where(eq(uploadBatches.id, batchId));
    await enqueue(ids.map((pageId) => ({ name: "page/process" as const, data: { pageId } })));
  } catch (err) {
    log("pdf split failed", { batchId, err: String(err) });
    await db
      .update(uploadBatches)
      .set({ status: "failed", error: "This PDF could not be opened. Export it again from the copier and upload it." })
      .where(eq(uploadBatches.id, batchId));
  }
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export const LOW_CONFIDENCE_FLAG = 0.7;

/**
 * What a submission is scored against. A teacher assignment brings its prompt, documents,
 * rubric version and class roster (for redaction). A practice essay brings its practice
 * prompt and the current rubric, and its only name to redact is the student's own.
 */
async function scoringTarget(sub: typeof submissions.$inferSelect) {
  if (sub.context === "practice") {
    if (!sub.practiceAttemptId) return null;
    const attempt = await db.query.practiceAttempts.findFirst({ where: eq(practiceAttempts.id, sub.practiceAttemptId) });
    const prompt = attempt ? practicePrompt(attempt.promptKey) : undefined;
    if (!attempt || !prompt) return null;
    const writer = await db.query.user.findFirst({ where: eq(user.id, attempt.userId) });
    const [firstName = "", ...rest] = (writer?.name ?? "").trim().split(/\s+/);
    const author = { firstName, lastName: rest.join(" ") };
    const rubric = rubricForEssayType(prompt.essayType);
    return {
      assignmentId: null,
      essayType: prompt.essayType,
      rubricKey: rubric.key,
      rubricVersion: rubric.version,
      promptText: prompt.promptText,
      sources: prompt.sources,
      courseLabel: null,
      author,
      roster: [author],
    };
  }

  if (!sub.assignmentId) return null;
  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.id, sub.assignmentId) });
  if (!assignment) return null;
  const author = sub.studentId ? await db.query.students.findFirst({ where: eq(students.id, sub.studentId) }) : undefined;
  const roster = await db
    .select({ firstName: students.firstName, lastName: students.lastName })
    .from(students)
    .where(eq(students.classId, assignment.classId));
  const cls = await db.query.classes.findFirst({ where: eq(classes.id, assignment.classId) });
  return {
    assignmentId: assignment.id,
    essayType: assignment.essayType,
    rubricKey: assignment.rubricKey,
    rubricVersion: assignment.rubricVersion,
    promptText: assignment.promptText,
    sources: assignment.sources,
    courseLabel: cls ? COURSES[cls.course].label : null,
    author: author ?? null,
    roster,
  };
}

export type PreparedScoring = {
  sub: typeof submissions.$inferSelect;
  target: NonNullable<Awaited<ReturnType<typeof scoringTarget>>>;
  rubric: Rubric;
  ctx: ScoringContext;
  contextBlock: string;
  essayText: string;
  spans: PageSpan[];
};

/**
 * Everything a rubric row needs: the redacted essay and its page spans, the rubric and the
 * shared context block. Null when the submission is not being scored; "empty" when there is
 * no essay text. Deterministic, so a queued row job rebuilds the same prompt later.
 */
export async function prepareScoring(submissionId: string): Promise<PreparedScoring | "empty" | null> {
  const sub = await db.query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
  // Only run when a teacher has sent it to scoring. A cancel moves it back first.
  if (!sub || sub.status !== "scoring") return null;

  const target = await scoringTarget(sub);
  if (!target) return null;
  const { author, roster } = target;

  // Build the essay text, redacted page by page so page boundaries stay known.
  let essayPages: { id: string; pageNumber: number; text: string }[];
  if (sub.inputKind === "typed") {
    essayPages = [{ id: "typed", pageNumber: 1, text: sub.typedText ?? "" }];
  } else {
    const subPages = await db.query.pages.findMany({
      where: and(eq(pages.submissionId, submissionId), eq(pages.status, "transcribed")),
      orderBy: asc(pages.pageNumber),
    });
    essayPages = subPages.map((p) => ({ id: p.id, pageNumber: p.pageNumber ?? 0, text: p.confirmedText ?? p.draftText ?? "" }));
  }
  const redactedPages = essayPages.map((p) => ({ ...p, text: redactText(p.text, author ?? null, roster) }));
  const { text: essayText, spans } = joinPages(redactedPages);

  if (essayText.trim().split(/\s+/).length < 5) return "empty";

  const rubric = getRubric(target.rubricKey, target.rubricVersion);
  const essayType = ESSAY_TYPES[target.essayType];
  const ctx: ScoringContext = {
    rubric,
    courseLabel: target.courseLabel ?? COURSES[essayType.course].label,
    essayTypeLabel: essayType.label,
    promptText: target.promptText,
    sources: target.sources,
    essayText,
    handwritten: sub.inputKind === "handwritten",
  };
  const contextBlock = buildContextBlock(ctx);
  return { sub, target, rubric, ctx, contextBlock, essayText, spans };
}

/**
 * Score a submission row by row. Teacher essays go to a local worker when that route is on
 * and a worker is online; practice essays always run here, because the student is waiting.
 */
export async function scoreSubmission(submissionId: string): Promise<void> {
  const prepared = await prepareScoring(submissionId);
  if (!prepared) return;
  if (prepared === "empty") {
    await db
      .update(submissions)
      .set({ status: "failed", error: "There is no essay text to score. Check the transcription." })
      .where(eq(submissions.id, submissionId));
    return;
  }
  const { sub, target, rubric, ctx, contextBlock, essayText } = prepared;
  const route = sub.context === "practice" ? "cloud" : await chooseRoute("score_row");

  const [run] = await db
    .insert(scoreRuns)
    .values({
      submissionId,
      model: route === "local" ? localModelFor("score_row") : env().MODEL_MODE === "fake" ? "fake" : env().SCORING_MODEL,
      promptVersion: SCORING_PROMPT_VERSION,
      rubricKey: rubric.key,
      rubricVersion: rubric.version,
      essayTextSha256: createHash("sha256").update(essayText).digest("hex"),
    })
    .returning();

  if (target.assignmentId) {
    await db.update(assignments).set({ lockedAt: new Date() }).where(and(eq(assignments.id, target.assignmentId), isNull(assignments.lockedAt)));
  }

  if (route === "local") {
    for (const row of rubric.rows) {
      await enqueueLocalJob("score_row", { submissionId, scoreRunId: run.id, rowKey: row.key, attempt: 1 });
    }
    return;
  }

  const scoreOne = async (row: RubricRow) => {
    const input = { submissionId, scoreRunId: run.id, rowKey: row.key };
    try {
      const result = await scoreRow(ctx, contextBlock, row);
      await saveRowScore(run.id, prepared, row, result);
      await recordCloudCall("score_row", input, { model: result.model, usage: result.usage });
    } catch (err) {
      log("row scoring failed", { submissionId, row: row.key, err: String(err) });
      await saveRowFailure(run.id, submissionId, row);
      await recordCloudCall("score_row", input, { error: String(err) });
    }
  };
  // Score the first row alone so it writes the prompt cache, then the rest in parallel reading from it.
  const [firstRow, ...otherRows] = rubric.rows;
  await scoreOne(firstRow);
  await Promise.all(otherRows.map(scoreOne));
  await finalizeRunIfDone(run.id);
}

/** Store one row's score, with quotes checked against the essay. A second save of the same row is ignored. */
export async function saveRowScore(
  runId: string,
  essay: { sub: { id: string }; essayText: string; spans: PageSpan[] },
  row: RubricRow,
  result: { output: RowOutput; feedbackIssues: string[] },
) {
  const { output, feedbackIssues } = result;
  const evidence: Evidence[] = output.evidence_quotes.slice(0, 3).map((quote) => {
    const found = findQuote(essay.essayText, quote);
    if (!found) return { quote, verified: false };
    const span = pageForOffset(essay.spans, found.start);
    return {
      quote,
      verified: true,
      start: found.start,
      end: found.end,
      ...(span && span.pageId !== "typed" ? { pageId: span.pageId, pageNumber: span.pageNumber } : {}),
    };
  });

  const points = Math.max(0, Math.min(row.maxPoints, output.points));
  const confidence = Math.max(0, Math.min(1, output.confidence));
  const flags: string[] = [];
  if (confidence < LOW_CONFIDENCE_FLAG) flags.push("low_confidence");
  if (output.borderline) flags.push("borderline");
  if (evidence.length === 0 || evidence.some((e) => !e.verified)) flags.push("unverified_evidence");
  if (feedbackIssues.length > 0) flags.push("feedback_check");

  await db
    .insert(rowScores)
    .values({
      scoreRunId: runId,
      submissionId: essay.sub.id,
      rowKey: row.key,
      maxPoints: row.maxPoints,
      aiPoints: points,
      points,
      justification: output.justification,
      aiStudentFeedback: output.student_feedback,
      studentFeedback: output.student_feedback,
      confidence,
      evidence,
      flags,
    })
    .onConflictDoNothing();
}

export async function saveRowFailure(runId: string, submissionId: string, row: RubricRow) {
  await db
    .insert(rowScores)
    .values({
      scoreRunId: runId,
      submissionId,
      rowKey: row.key,
      maxPoints: row.maxPoints,
      flags: ["failed"],
      error: "This row could not be scored. Score it yourself or rescore the essay.",
    })
    .onConflictDoNothing();
}

/**
 * Close a score run once every row has a result. Totals come from the run's model jobs,
 * local and cloud alike. Safe to call from several row jobs at once: only one closes it.
 */
export async function finalizeRunIfDone(runId: string): Promise<void> {
  const run = await db.query.scoreRuns.findFirst({ where: eq(scoreRuns.id, runId) });
  if (!run || run.status !== "running") return;
  const rubric = getRubric(run.rubricKey, run.rubricVersion);
  const rows = await db.select({ flags: rowScores.flags }).from(rowScores).where(eq(rowScores.scoreRunId, runId));
  if (rows.length < rubric.rows.length) return;

  const failures = rows.filter((r) => r.flags.includes("failed")).length;
  const allFailed = failures === rubric.rows.length;
  const tagged = sql`${llmJobs.input}->>'scoreRunId' = ${runId}`;
  const [totals] = await db
    .select({
      tokensIn: sql<number>`coalesce(sum(${llmJobs.tokensIn}), 0)`.mapWith(Number),
      tokensOut: sql<number>`coalesce(sum(${llmJobs.tokensOut}), 0)`.mapWith(Number),
      cacheRead: sql<number>`coalesce(sum(${llmJobs.cacheReadTokens}), 0)`.mapWith(Number),
      cacheWrite: sql<number>`coalesce(sum(${llmJobs.cacheWriteTokens}), 0)`.mapWith(Number),
      cost: sql<number>`coalesce(sum(${llmJobs.costUsd}), 0)`.mapWith(Number),
    })
    .from(llmJobs)
    .where(tagged);
  const models = await db
    .selectDistinct({ model: llmJobs.model })
    .from(llmJobs)
    .where(and(tagged, eq(llmJobs.status, "completed")));
  const model = models.map((m) => m.model).filter(Boolean).sort().join(" + ") || run.model;

  const [closed] = await db
    .update(scoreRuns)
    .set({
      status: allFailed ? "failed" : "completed",
      model,
      inputTokens: totals.tokensIn,
      outputTokens: totals.tokensOut,
      cacheReadTokens: totals.cacheRead,
      cacheWriteTokens: totals.cacheWrite,
      costUsd: totals.cost.toFixed(5),
      completedAt: new Date(),
      error: allFailed ? "Every row failed to score." : null,
    })
    .where(and(eq(scoreRuns.id, runId), eq(scoreRuns.status, "running")))
    .returning({ id: scoreRuns.id });
  if (!closed) return;

  // Only finish if nobody cancelled while we were scoring.
  await db
    .update(submissions)
    .set(allFailed ? { status: "failed", error: "Scoring failed. Try again in a few minutes." } : { status: "scored", error: null })
    .where(and(eq(submissions.id, run.submissionId), eq(submissions.status, "scoring")));
  log("submission scored", { submissionId: run.submissionId, model, costUsd: totals.cost, failures });
}

/** Latest score run for each submission, used by review screens and exports. */
export async function latestRunIds(submissionIds: string[]): Promise<Map<string, string>> {
  if (submissionIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([scoreRuns.submissionId], { submissionId: scoreRuns.submissionId, id: scoreRuns.id })
    .from(scoreRuns)
    .where(and(inArray(scoreRuns.submissionId, submissionIds), ne(scoreRuns.status, "running")))
    .orderBy(scoreRuns.submissionId, sql`${scoreRuns.startedAt} desc`);
  return new Map(rows.map((r) => [r.submissionId, r.id]));
}
