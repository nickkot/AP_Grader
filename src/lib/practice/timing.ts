import type { EssayType } from "@/lib/rubrics";

/**
 * Timed practice per essay type: AP's suggested time for that essay on the exam, with the
 * reading period where the exam has one. Stored as data so it can be corrected in one place.
 * Check against the current AP Course and Exam Description before launch
 * (docs/STUDENT_PRACTICE_PLAN.md, open question 8).
 */
export const PRACTICE_TIMING: Record<EssayType, { readingMinutes: number; writingMinutes: number }> = {
  APUSH_DBQ: { readingMinutes: 15, writingMinutes: 45 },
  LANG_ARG: { readingMinutes: 0, writingMinutes: 40 },
};

/** A timed essay that arrives this long after its deadline is still accepted, to cover slow networks. */
export const SUBMIT_GRACE_MS = 60_000;

export function timedWindow(essayType: EssayType, start: Date) {
  const t = PRACTICE_TIMING[essayType];
  const readingEndsAt = t.readingMinutes > 0 ? new Date(start.getTime() + t.readingMinutes * 60_000) : null;
  const deadlineAt = new Date(start.getTime() + (t.readingMinutes + t.writingMinutes) * 60_000);
  return { readingEndsAt, deadlineAt };
}

export function totalMinutes(essayType: EssayType) {
  const t = PRACTICE_TIMING[essayType];
  return t.readingMinutes + t.writingMinutes;
}
