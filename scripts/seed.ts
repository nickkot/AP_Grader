/**
 * Seed a demo teacher with two classes and realistic essays in every state.
 * Development only. Run with: npm run db:seed
 *
 * Demo sign-in (dev login must be enabled): demo@example.com / demo-password
 */
import { config } from "dotenv";
config({ override: true });

import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";

import { getAuth } from "@/lib/auth";
import { findQuote, joinPages, pageForOffset } from "@/lib/ai/quotes";
import { SCORING_PROMPT_VERSION } from "@/lib/ai/score";
import { getDb } from "@/lib/db";
import {
  assignments,
  classes,
  pages,
  rowScores,
  scoreRuns,
  students,
  submissions,
  user,
  type Evidence,
  type TranscriptLine,
} from "@/lib/db/schema";
import { DEMO_DBQ, DEMO_DBQ_ESSAYS, DEMO_LANG, DEMO_LANG_ESSAYS, DEMO_ROSTER, type DemoEssay } from "@/lib/demo/content";
import { ensurePacketTokens } from "@/lib/packet/tokens";
import { ESSAY_TYPES, rubricForEssayType } from "@/lib/rubrics";
import { putObject } from "@/lib/storage";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo-password";

type ManifestEntry = { essayKey: string; pageNumber: number; pageCount: number; file: string; lines: string[]; text: string };

const db = getDb();

function toTranscript(lines: string[], lowEvery: number): TranscriptLine[] {
  let n = 0;
  return lines.map((line) => {
    const words: TranscriptLine["words"] = [];
    const re = /\[deleted: ([^\]]+)\]|(\S+)/g;
    for (const m of line.matchAll(re)) {
      n++;
      if (m[1]) words.push({ text: m[1], confidence: 0.9, deleted: true });
      else words.push({ text: m[2], confidence: lowEvery > 0 && n % lowEvery === 0 ? 0.58 : 0.96 });
    }
    return { words };
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Do not seed demo data in production.");

  // Fresh demo account every run.
  await db.delete(user).where(eq(user.email, DEMO_EMAIL));
  await getAuth().api.signUpEmail({ body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo Teacher" } });
  const teacher = await db.query.user.findFirst({ where: eq(user.email, DEMO_EMAIL) });
  if (!teacher) throw new Error("Could not create the demo teacher. Is ENABLE_DEV_LOGIN=true?");

  const manifest: ManifestEntry[] = JSON.parse(await readFile(path.join("src/lib/demo/pages/manifest.json"), "utf8"));

  /* ---------------- APUSH class with handwritten DBQs ---------------- */
  const [apush] = await db.insert(classes).values({ teacherId: teacher.id, course: "APUSH", name: "Period 3 (demo)" }).returning();
  const apushStudents = await db
    .insert(students)
    .values(DEMO_ROSTER.map((s) => ({ ...s, classId: apush.id, teacherId: teacher.id })))
    .returning();
  const byName = (first: string, last: string, list = apushStudents) =>
    list.find((s) => s.firstName === first && s.lastName === last)!;

  const dbqRubric = rubricForEssayType("APUSH_DBQ");
  const [dbq] = await db
    .insert(assignments)
    .values({
      teacherId: teacher.id,
      classId: apush.id,
      essayType: "APUSH_DBQ",
      title: DEMO_DBQ.title,
      promptText: DEMO_DBQ.promptText,
      sources: DEMO_DBQ.sources,
      timeLimitMinutes: ESSAY_TYPES.APUSH_DBQ.defaultTimeLimitMinutes,
      readingMinutes: ESSAY_TYPES.APUSH_DBQ.defaultReadingMinutes,
      answerPagesPerStudent: 2,
      rubricKey: dbqRubric.key,
      rubricVersion: dbqRubric.version,
      lockedAt: new Date(),
    })
    .returning();
  await ensurePacketTokens({ assignmentId: dbq.id, studentIds: apushStudents.map((s) => s.id), pagesPerStudent: 2, spareSets: 2 });

  // State for each demo essay, to cover every screen state.
  const plan: Record<string, "approved" | "scored" | "needs_confirmation" | "failed"> = {
    "dbq-01": "approved",
    "dbq-02": "approved",
    "dbq-03": "scored",
    "dbq-04": "scored",
    "dbq-05": "scored",
    "dbq-06": "needs_confirmation",
    "dbq-07": "failed",
    "dbq-08": "scored",
  };

  for (const essay of DEMO_DBQ_ESSAYS) {
    const student = byName(essay.studentFirstName, essay.studentLastName);
    const state = plan[essay.key] ?? "scored";
    const [sub] = await db
      .insert(submissions)
      .values({
        assignmentId: dbq.id,
        studentId: student.id,
        inputKind: "handwritten",
        status: state,
        error: state === "failed" ? "No page could be read. Retake the photos." : null,
        confirmedAt: state === "approved" || state === "scored" ? new Date() : null,
        confirmedBy: state === "approved" || state === "scored" ? teacher.id : null,
        approvedAt: state === "approved" ? new Date() : null,
        approvedBy: state === "approved" ? teacher.id : null,
      })
      .returning();

    const entries = manifest.filter((m) => m.essayKey === essay.key).sort((a, b) => a.pageNumber - b.pageNumber);
    const pageRows: { id: string; pageNumber: number; text: string }[] = [];
    for (const entry of entries) {
      const image = await readFile(path.join("src/lib/demo/pages", entry.file));
      const id = crypto.randomUUID();
      const key = `assignments/${dbq.id}/pages/${id}.jpg`;
      await putObject(key, image, "image/jpeg");
      // dbq-07: page 2 has no readable QR, so it waits on the match screen.
      const unmatched = essay.key === "dbq-07" && entry.pageNumber === 2;
      const failed = essay.key === "dbq-07" && entry.pageNumber === 1;
      const transcript = toTranscript(entry.lines, essay.key === "dbq-06" ? 23 : 0);
      const low = transcript.flatMap((l) => l.words).filter((w) => !w.deleted && w.confidence < 0.75).length;
      await db.insert(pages).values({
        id,
        assignmentId: dbq.id,
        submissionId: unmatched ? null : sub.id,
        pageNumber: unmatched ? null : entry.pageNumber,
        matchMethod: unmatched ? null : "qr",
        originalKey: key,
        processedKey: key,
        contentType: "image/jpeg",
        sizeBytes: image.length,
        sha256: `demo-${essay.key}-${entry.pageNumber}`,
        uploadedBy: teacher.id,
        status: unmatched ? "unmatched" : failed ? "failed" : "transcribed",
        error: unmatched ? "No QR code found. Match this page by hand." : failed ? "This page could not be read. Retake the photo in better light." : null,
        transcriptionModel: unmatched || failed ? null : "claude-haiku-5-5",
        transcriptionPromptVersion: unmatched || failed ? null : "transcribe-v1",
        transcript: unmatched || failed ? null : transcript,
        draftText: unmatched || failed ? null : entry.text,
        confirmedText: state === "approved" || state === "scored" ? entry.text : null,
        meanConfidence: 0.95,
        lowConfidenceCount: low,
        transcribedAt: new Date(),
      });
      if (!unmatched && !failed) pageRows.push({ id, pageNumber: entry.pageNumber, text: entry.text });
    }

    if (state === "approved" || state === "scored") await seedScores(sub.id, essay, dbqRubric.key, dbqRubric.version, pageRows, state === "approved", teacher.id);
  }

  /* ---------------- AP Lang class with typed argument essays ---------------- */
  const langNames = DEMO_LANG_ESSAYS.map((e) => ({ firstName: e.studentFirstName, lastName: e.studentLastName }));
  const langRoster = [...langNames, ...DEMO_ROSTER.filter((r) => !langNames.some((l) => l.firstName === r.firstName && l.lastName === r.lastName)).slice(0, 8)];
  const [lang] = await db.insert(classes).values({ teacherId: teacher.id, course: "AP_LANG", name: "Period 5 (demo)" }).returning();
  const langStudents = await db
    .insert(students)
    .values(langRoster.map((s) => ({ ...s, classId: lang.id, teacherId: teacher.id })))
    .returning();
  const langRubric = rubricForEssayType("LANG_ARG");
  const [arg] = await db
    .insert(assignments)
    .values({
      teacherId: teacher.id,
      classId: lang.id,
      essayType: "LANG_ARG",
      title: DEMO_LANG.title,
      promptText: DEMO_LANG.promptText,
      sources: [],
      timeLimitMinutes: ESSAY_TYPES.LANG_ARG.defaultTimeLimitMinutes,
      readingMinutes: 0,
      answerPagesPerStudent: 3,
      rubricKey: langRubric.key,
      rubricVersion: langRubric.version,
      lockedAt: new Date(),
    })
    .returning();
  for (const [i, essay] of DEMO_LANG_ESSAYS.entries()) {
    const student = byName(essay.studentFirstName, essay.studentLastName, langStudents);
    const approved = i === 0;
    const [sub] = await db
      .insert(submissions)
      .values({
        assignmentId: arg.id,
        studentId: student.id,
        inputKind: "typed",
        typedText: essay.text,
        status: approved ? "approved" : "scored",
        confirmedAt: new Date(),
        confirmedBy: teacher.id,
        approvedAt: approved ? new Date() : null,
        approvedBy: approved ? teacher.id : null,
      })
      .returning();
    await seedScores(sub.id, essay, langRubric.key, langRubric.version, [{ id: "typed", pageNumber: 1, text: essay.text }], approved, teacher.id);
  }

  console.log(`Seeded demo data. Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

async function seedScores(
  submissionId: string,
  essay: DemoEssay,
  rubricKey: string,
  rubricVersion: number,
  pageRows: { id: string; pageNumber: number; text: string }[],
  approved: boolean,
  teacherId: string,
) {
  const { text, spans } = joinPages(pageRows);
  const [run] = await db
    .insert(scoreRuns)
    .values({
      submissionId,
      model: "claude-sonnet-5-5",
      promptVersion: SCORING_PROMPT_VERSION,
      rubricKey,
      rubricVersion,
      essayTextSha256: `demo-${essay.key}`,
      status: "completed",
      inputTokens: 9000,
      outputTokens: 6200,
      cacheReadTokens: 41000,
      costUsd: "0.08700",
      completedAt: new Date(),
    })
    .returning();
  const rubric = rubricForEssayType(rubricKey === "apush-dbq" ? "APUSH_DBQ" : "LANG_ARG");
  for (const row of rubric.rows) {
    const s = essay.scores[row.key];
    if (!s) continue;
    const evidence: Evidence[] = s.quotes.map((quote) => {
      const found = findQuote(text, quote);
      if (!found) return { quote, verified: false };
      const span = pageForOffset(spans, found.start);
      return { quote, verified: true, start: found.start, end: found.end, ...(span && span.pageId !== "typed" ? { pageId: span.pageId, pageNumber: span.pageNumber } : {}) };
    });
    const flags: string[] = [];
    if (s.confidence < 0.7) flags.push("low_confidence");
    if (evidence.some((e) => !e.verified)) flags.push("unverified_evidence");
    await db.insert(rowScores).values({
      scoreRunId: run.id,
      submissionId,
      rowKey: row.key,
      maxPoints: row.maxPoints,
      aiPoints: s.points,
      points: s.points,
      justification: s.justification,
      aiStudentFeedback: s.studentFeedback,
      studentFeedback: s.studentFeedback,
      confidence: s.confidence,
      evidence,
      flags,
      reviewStatus: approved ? "accepted" : "pending",
      reviewedBy: approved ? teacherId : null,
      reviewedAt: approved ? new Date() : null,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
