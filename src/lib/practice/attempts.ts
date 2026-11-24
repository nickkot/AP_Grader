import "server-only";
import { and, count, desc, eq, gt, inArray, isNull, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { classes, classMemberships, practiceAttempts, rowScores, scoreRuns, submissions } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs";
import { practicePrompt, PRACTICE_PROMPTS, type PracticePrompt } from "@/lib/practice/prompts";
import { SUBMIT_GRACE_MS, timedWindow } from "@/lib/practice/timing";
import { ESSAY_TYPES, getRubric, rubricForEssayType } from "@/lib/rubrics";

/**
 * Practice essays: start, autosave, submit, score, read back. Every function takes the
 * student's user id and only touches that student's own attempts.
 */

/** Scored practice essays per student per day. Keeps cost bounded until per-plan limits exist. */
export const DAILY_PRACTICE_LIMIT = 10;
export const MAX_ESSAY_CHARS = 60_000;

export type Attempt = typeof practiceAttempts.$inferSelect;

export function wordCount(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export async function getAttempt(userId: string, attemptId: string) {
  return (
    (await db.query.practiceAttempts.findFirst({
      where: and(eq(practiceAttempts.id, attemptId), eq(practiceAttempts.userId, userId)),
    })) ?? null
  );
}

/** Start a practice essay, or return the unfinished one already open for this prompt and mode. */
export async function startAttempt(userId: string, promptKey: string, mode: "timed" | "untimed", now = new Date()) {
  const prompt = practicePrompt(promptKey);
  if (!prompt) return { error: "That prompt is not in the library." } as const;

  const open = await db.query.practiceAttempts.findFirst({
    where: and(
      eq(practiceAttempts.userId, userId),
      eq(practiceAttempts.promptKey, prompt.key),
      eq(practiceAttempts.mode, mode),
      isNull(practiceAttempts.submittedAt),
    ),
    orderBy: desc(practiceAttempts.startedAt),
  });
  if (open && (!open.deadlineAt || open.deadlineAt.getTime() + SUBMIT_GRACE_MS > now.getTime())) return { attempt: open } as const;

  const window = mode === "timed" ? timedWindow(prompt.essayType, now) : { readingEndsAt: null, deadlineAt: null };
  const [attempt] = await db
    .insert(practiceAttempts)
    .values({ userId, promptKey: prompt.key, promptVersion: prompt.version, mode, startedAt: now, ...window })
    .returning();
  return { attempt } as const;
}

function pastDeadline(attempt: Attempt, now: Date) {
  return attempt.deadlineAt !== null && now.getTime() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS;
}

/** Save the draft. Older saves (lower sequence) and saves after time is up are ignored. */
export async function saveDraft(userId: string, attemptId: string, text: string, seq: number, now = new Date()) {
  const attempt = await getAttempt(userId, attemptId);
  if (!attempt) return { error: "Essay not found." } as const;
  if (attempt.submittedAt) return { error: "This essay is already submitted." } as const;
  if (pastDeadline(attempt, now)) return { error: "Time is up." } as const;
  if (text.length > MAX_ESSAY_CHARS) return { error: "This essay is too long to save." } as const;
  // One conditional update: a save that arrives after a newer one changes nothing.
  const [row] = await db
    .update(practiceAttempts)
    .set({ draftText: text, draftSeq: seq, draftSavedAt: now })
    .where(and(eq(practiceAttempts.id, attempt.id), lt(practiceAttempts.draftSeq, seq), isNull(practiceAttempts.submittedAt)))
    .returning({ seq: practiceAttempts.draftSeq });
  return row ? ({ ok: true, savedAt: now.toISOString() } as const) : ({ ok: true, stale: true } as const);
}

export async function scoredToday(userId: string, now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: count() })
    .from(practiceAttempts)
    .where(and(eq(practiceAttempts.userId, userId), gt(practiceAttempts.submittedAt, dayStart)));
  return row?.n ?? 0;
}

/**
 * Submit for scoring. After the deadline (plus grace) only the last saved draft counts,
 * so nothing typed after time ran out is scored.
 */
export async function submitAttempt(userId: string, attemptId: string, text: string, auto: boolean, now = new Date()) {
  const attempt = await getAttempt(userId, attemptId);
  if (!attempt) return { error: "Essay not found." } as const;
  if (attempt.submittedAt) return { ok: true } as const;

  const late = pastDeadline(attempt, now);
  const finalText = (late ? attempt.draftText : text).slice(0, MAX_ESSAY_CHARS);
  const timeUp = auto || late;
  if (!timeUp && wordCount(finalText) < 5) return { error: "Write a few sentences before you submit." } as const;
  if ((await scoredToday(userId, now)) >= DAILY_PRACTICE_LIMIT) {
    return { error: `You have submitted ${DAILY_PRACTICE_LIMIT} essays today. You can submit more tomorrow.` } as const;
  }

  const submissionId = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(practiceAttempts)
      .set({ draftText: finalText, submittedAt: now, autoSubmitted: timeUp })
      .where(and(eq(practiceAttempts.id, attempt.id), isNull(practiceAttempts.submittedAt)))
      .returning({ id: practiceAttempts.id });
    if (!claimed) return null;
    const [sub] = await tx
      .insert(submissions)
      .values({ context: "practice", practiceAttemptId: attempt.id, inputKind: "typed", typedText: finalText, status: "scoring", confirmedAt: now })
      .returning({ id: submissions.id });
    return sub.id;
  });
  if (submissionId) await enqueue({ name: "submission/score", data: { submissionId } });
  return { ok: true } as const;
}

/** Score again after a failed run. */
export async function retryScoring(userId: string, attemptId: string) {
  const attempt = await getAttempt(userId, attemptId);
  if (!attempt) return { error: "Essay not found." } as const;
  const [sub] = await db
    .update(submissions)
    .set({ status: "scoring", error: null })
    .where(and(eq(submissions.practiceAttemptId, attempt.id), eq(submissions.status, "failed")))
    .returning({ id: submissions.id });
  if (sub) await enqueue({ name: "submission/score", data: { submissionId: sub.id } });
  return { ok: true } as const;
}

export type RowResult = {
  key: string;
  label: string;
  points: number | null;
  maxPoints: number;
  feedback: string | null;
  quotes: string[];
  unsure: boolean;
  failed: boolean;
};

/** What the student sees after scoring: rows in rubric order, verified quotes only, no teacher notes. */
export async function attemptResult(attempt: Attempt) {
  const sub = await db.query.submissions.findFirst({ where: eq(submissions.practiceAttemptId, attempt.id) });
  if (!sub) return null;
  const run = await db.query.scoreRuns.findFirst({ where: eq(scoreRuns.submissionId, sub.id), orderBy: desc(scoreRuns.startedAt) });
  const prompt = practicePrompt(attempt.promptKey);
  const rubric = run ? getRubric(run.rubricKey, run.rubricVersion) : prompt ? rubricForEssayType(prompt.essayType) : null;
  const rows = run && sub.status === "scored" ? await db.query.rowScores.findMany({ where: eq(rowScores.scoreRunId, run.id) }) : [];
  const byKey = new Map(rows.map((r) => [r.rowKey, r]));
  const results: RowResult[] = (rubric?.rows ?? []).map((def) => {
    const r = byKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      points: r?.points ?? null,
      maxPoints: def.maxPoints,
      feedback: r?.studentFeedback ?? null,
      quotes: (r?.evidence ?? []).filter((e) => e.verified).map((e) => e.quote),
      unsure: Boolean(r && (r.flags.includes("low_confidence") || r.flags.includes("borderline"))),
      failed: Boolean(r?.flags.includes("failed")),
    };
  });
  const scored = results.filter((r) => r.points !== null);
  return {
    status: sub.status,
    error: sub.error,
    essayText: sub.typedText ?? "",
    rows: results,
    total: scored.reduce((s, r) => s + (r.points ?? 0), 0),
    maxTotal: rubric?.maxPoints ?? 0,
  };
}

export type HistoryItem = {
  id: string;
  prompt: PracticePrompt | undefined;
  mode: "timed" | "untimed";
  startedAt: Date;
  submittedAt: Date | null;
  status: "writing" | "scoring" | "scored" | "failed";
  total: number | null;
  maxTotal: number | null;
};

/** Every practice essay by this student, newest first, with its score once scored. */
export async function practiceHistory(userId: string): Promise<HistoryItem[]> {
  const attempts = await db.query.practiceAttempts.findMany({ where: eq(practiceAttempts.userId, userId), orderBy: desc(practiceAttempts.startedAt) });
  if (attempts.length === 0) return [];
  const subs = await db.query.submissions.findMany({
    where: inArray(
      submissions.practiceAttemptId,
      attempts.map((a) => a.id),
    ),
  });
  const runs = subs.length
    ? await db.query.scoreRuns.findMany({ where: inArray(scoreRuns.submissionId, subs.map((s) => s.id)), orderBy: desc(scoreRuns.startedAt) })
    : [];
  const latestRun = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!latestRun.has(r.submissionId)) latestRun.set(r.submissionId, r);
  const rows = latestRun.size
    ? await db.query.rowScores.findMany({ where: inArray(rowScores.scoreRunId, [...latestRun.values()].map((r) => r.id)) })
    : [];

  return attempts.map((a) => {
    const sub = subs.find((s) => s.practiceAttemptId === a.id);
    const run = sub ? latestRun.get(sub.id) : undefined;
    const prompt = practicePrompt(a.promptKey);
    const scored = sub?.status === "scored" && run;
    const runRows = scored ? rows.filter((r) => r.scoreRunId === run.id) : [];
    return {
      id: a.id,
      prompt,
      mode: a.mode,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      status: !sub ? "writing" : sub.status === "scored" ? "scored" : sub.status === "failed" ? "failed" : "scoring",
      total: scored ? runRows.reduce((s, r) => s + (r.points ?? 0), 0) : null,
      maxTotal: scored ? getRubric(run.rubricKey, run.rubricVersion).maxPoints : null,
    };
  });
}

/** Classes this student joined, for the "your teacher can see this" note and course order. */
export async function studentClasses(userId: string) {
  return db
    .select({ id: classes.id, name: classes.name, course: classes.course })
    .from(classMemberships)
    .innerJoin(classes, eq(classes.id, classMemberships.classId))
    .where(eq(classMemberships.userId, userId));
}

/** The next prompt to suggest: one the student has not submitted, from their own courses first. */
export function nextPrompt(history: HistoryItem[], courses: string[]): PracticePrompt | undefined {
  const done = new Set(history.filter((h) => h.submittedAt).map((h) => h.prompt?.key));
  const order = [...PRACTICE_PROMPTS].sort((a, b) => {
    const ca = courses.includes(courseOf(a)) ? 0 : 1;
    const cb = courses.includes(courseOf(b)) ? 0 : 1;
    return ca - cb;
  });
  return order.find((p) => !done.has(p.key)) ?? order[0];
}

function courseOf(p: PracticePrompt) {
  return ESSAY_TYPES[p.essayType].course;
}
