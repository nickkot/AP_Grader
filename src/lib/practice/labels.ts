import type { PracticePrompt } from "@/lib/practice/prompts";
import { PRACTICE_TIMING, totalMinutes } from "@/lib/practice/timing";
import { COURSES, ESSAY_TYPES } from "@/lib/rubrics";

export function courseLabel(p: PracticePrompt) {
  return COURSES[ESSAY_TYPES[p.essayType].course].label;
}

export function essayTypeLabel(p: PracticePrompt) {
  return ESSAY_TYPES[p.essayType].label;
}

/** "15-minute reading period, then 45 minutes to write" or "40 minutes". */
export function timingLabel(p: PracticePrompt) {
  const t = PRACTICE_TIMING[p.essayType];
  return t.readingMinutes > 0
    ? `${t.readingMinutes}-minute reading period, then ${t.writingMinutes} minutes to write`
    : `${totalMinutes(p.essayType)} minutes`;
}

export function scoreLabel(total: number | null, max: number | null) {
  return total === null || max === null ? null : `${total} of ${max}`;
}
