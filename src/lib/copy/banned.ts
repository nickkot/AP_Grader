/**
 * Banned words and phrases. One source of truth for:
 * - the CI copy lint (scripts/copy-lint.ts), from the product-voice and
 *   student-feedback-writing skills,
 * - the runtime check on model feedback,
 * - unit tests.
 */

/** From .claude/skills/product-voice/SKILL.md. Checked in UI copy. */
export const BANNED_UI_WORDS = [
  "seamless",
  "seamlessly",
  "empower",
  "unlock",
  "elevate",
  "revolutionize",
  "transform",
  "supercharge",
  "game-changer",
  "cutting-edge",
  "next-level",
  "harness",
  "leverage",
  "robust",
  "delve",
  "journey",
  "magic",
  "effortless",
  "ai-powered",
  "intelligent insights",
  "at your fingertips",
  "take it to the next level",
  "we're excited",
  "oops",
  "uh-oh",
  "awesome",
  "amazing",
  "simply",
  "easily",
] as const;

/** From .claude/skills/student-feedback-writing/SKILL.md. Checked in feedback and prompt templates. */
export const BANNED_FEEDBACK_PHRASES = [
  "great job",
  "nice work",
  "overall, this essay",
  "you did a wonderful job",
  "keep up the good work",
  "it's clear that you",
  "it is clear that you",
  "this essay demonstrates",
  "add more analysis",
  "be more specific",
  "elaborate further",
  "strengthen your argument",
  "consider adding",
  "may perhaps",
] as const;

export const BANNED_CHARACTERS = ["!", "—"] as const;

export type CopyViolation = { phrase: string; index: number };

function findPhrases(text: string, phrases: readonly string[]): CopyViolation[] {
  const lower = text.toLowerCase().replace(/’/g, "'");
  const hits: CopyViolation[] = [];
  for (const phrase of phrases) {
    const re = new RegExp(`(?<![a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "g");
    for (const m of lower.matchAll(re)) hits.push({ phrase, index: m.index ?? 0 });
  }
  return hits;
}

/** Violations in model-written or template feedback text. */
export function feedbackViolations(text: string): CopyViolation[] {
  const hits = findPhrases(text, BANNED_FEEDBACK_PHRASES);
  for (const ch of BANNED_CHARACTERS) {
    const i = text.indexOf(ch);
    if (i !== -1) hits.push({ phrase: ch, index: i });
  }
  return hits;
}

/** Violations in UI copy. "just" is only banned in instructions, so it is not checked automatically. */
export function uiViolations(text: string): CopyViolation[] {
  return findPhrases(text, BANNED_UI_WORDS);
}

export function sentenceCount(text: string): number {
  return text
    .split(/(?<=[.?])\s+(?=[A-Z"'])/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Student-facing feedback limits from the student-feedback-writing skill. */
export const STUDENT_FEEDBACK_MAX_SENTENCES = 3;
export const STUDENT_FEEDBACK_MAX_WORDS = 70;
export const QUOTE_MAX_WORDS = 25;
