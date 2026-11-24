import { describe, expect, it } from "vitest";

import {
  DEMO_DBQ,
  DEMO_DBQ_ESSAYS,
  DEMO_LANG,
  DEMO_LANG_ESSAYS,
  DEMO_ROSTER,
  type DemoEssay,
} from "@/lib/demo/content";
import { rubricForEssayType } from "@/lib/rubrics";

const BANNED_FEEDBACK = [
  "great job",
  "nice work",
  "overall, this essay",
  "you did a wonderful job",
  "keep up the good work",
  "it's clear that you",
  "this essay demonstrates",
  "add more analysis",
  "be more specific",
  "elaborate further",
  "strengthen your argument",
  "consider adding",
];

function sentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.?!]["'”]?)\s+/)
    .filter((s) => s.trim().length > 0);
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Text inside double quotes, with trailing punctuation that sits inside the quote marks removed. */
function quotedSpans(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1].replace(/[.,;:]+$/, ""));
}

const sets: { label: string; essays: DemoEssay[]; essayType: "APUSH_DBQ" | "LANG_ARG" }[] = [
  { label: "DBQ", essays: DEMO_DBQ_ESSAYS, essayType: "APUSH_DBQ" },
  { label: "Lang", essays: DEMO_LANG_ESSAYS, essayType: "LANG_ARG" },
];

describe("demo assignments", () => {
  it("DBQ has 7 numbered sources within length limits", () => {
    expect(DEMO_DBQ.sources).toHaveLength(7);
    DEMO_DBQ.sources.forEach((s, i) => {
      expect(s.number).toBe(i + 1);
      expect(s.citation.length).toBeGreaterThan(10);
      const n = words(s.text);
      expect(n, `Doc ${s.number} length`).toBeGreaterThanOrEqual(60);
      expect(n, `Doc ${s.number} length`).toBeLessThanOrEqual(150);
    });
  });

  it("Lang prompt has no sources", () => {
    expect(DEMO_LANG.sources).toHaveLength(0);
    expect(DEMO_LANG.promptText.length).toBeGreaterThan(50);
  });

  it("has the expected number of essays", () => {
    expect(DEMO_DBQ_ESSAYS).toHaveLength(8);
    expect(DEMO_LANG_ESSAYS).toHaveLength(4);
  });

  it("uses no exclamation marks or em dashes anywhere", () => {
    const all = JSON.stringify({ DEMO_DBQ, DEMO_LANG, DEMO_DBQ_ESSAYS, DEMO_LANG_ESSAYS, DEMO_ROSTER });
    expect(all).not.toContain("!");
    expect(all).not.toContain("—");
  });
});

for (const { label, essays, essayType } of sets) {
  const rubric = rubricForEssayType(essayType);
  const rowKeys = rubric.rows.map((r) => r.key).sort();

  describe(`${label} demo essays`, () => {
    it("have unique keys and realistic length", () => {
      expect(new Set(essays.map((e) => e.key)).size).toBe(essays.length);
      for (const essay of essays) {
        const n = words(essay.text);
        expect(n, `${essay.key} word count`).toBeGreaterThanOrEqual(250);
        expect(n, `${essay.key} word count`).toBeLessThanOrEqual(550);
      }
    });

    for (const essay of essays) {
      describe(essay.key, () => {
        it("scores every rubric row and nothing else", () => {
          expect(Object.keys(essay.scores).sort()).toEqual(rowKeys);
        });

        it("keeps points and confidence in range", () => {
          for (const row of rubric.rows) {
            const s = essay.scores[row.key];
            expect(Number.isInteger(s.points)).toBe(true);
            expect(s.points).toBeGreaterThanOrEqual(0);
            expect(s.points).toBeLessThanOrEqual(row.maxPoints);
            expect(s.confidence).toBeGreaterThanOrEqual(0);
            expect(s.confidence).toBeLessThanOrEqual(1);
          }
        });

        it("quotes the essay verbatim, in under 25 words", () => {
          for (const [rowKey, s] of Object.entries(essay.scores)) {
            expect(s.quotes.length, `${rowKey} has a quote`).toBeGreaterThan(0);
            for (const q of s.quotes) {
              expect(essay.text, `${rowKey} quote: ${q}`).toContain(q);
              expect(words(q), `${rowKey} quote length`).toBeLessThan(25);
            }
            for (const q of quotedSpans(s.studentFeedback)) {
              expect(essay.text, `${rowKey} feedback quote: ${q}`).toContain(q);
            }
          }
        });

        it("keeps student feedback short and free of banned phrases", () => {
          for (const [rowKey, s] of Object.entries(essay.scores)) {
            const fb = s.studentFeedback;
            expect(sentences(fb).length, `${rowKey} sentences: ${fb}`).toBeLessThanOrEqual(3);
            expect(words(fb), `${rowKey} words`).toBeLessThanOrEqual(70);
            expect(fb).not.toContain("!");
            expect(fb).not.toContain("—");
            const lower = fb.toLowerCase();
            for (const phrase of BANNED_FEEDBACK) {
              expect(lower, `${rowKey} contains "${phrase}"`).not.toContain(phrase);
            }
            const label = rubric.rows.find((r) => r.key === rowKey)!.label;
            expect(fb.startsWith(`${label}:`), `${rowKey} starts with its verdict`).toBe(true);
          }
        });

        it("keeps teacher justifications to two sentences", () => {
          for (const [rowKey, s] of Object.entries(essay.scores)) {
            expect(sentences(s.justification).length, `${rowKey}`).toBeLessThanOrEqual(2);
            const lower = s.justification.toLowerCase();
            for (const phrase of BANNED_FEEDBACK) expect(lower).not.toContain(phrase);
          }
        });
      });
    }
  });
}

describe("demo score spread", () => {
  it("covers a range of DBQ totals", () => {
    const totals = DEMO_DBQ_ESSAYS.map((e) => Object.values(e.scores).reduce((sum, s) => sum + s.points, 0));
    expect(Math.min(...totals)).toBeLessThanOrEqual(1);
    expect(Math.max(...totals)).toBeGreaterThanOrEqual(6);
  });

  it("includes some low-confidence rows for the needs-review state", () => {
    const low = [...DEMO_DBQ_ESSAYS, ...DEMO_LANG_ESSAYS].flatMap((e) =>
      Object.values(e.scores).filter((s) => s.confidence < 0.6),
    );
    expect(low.length).toBeGreaterThanOrEqual(2);
    expect(low.length).toBeLessThanOrEqual(4);
  });
});

describe("demo roster", () => {
  it("has 32 unique names including every essay author", () => {
    expect(DEMO_ROSTER).toHaveLength(32);
    const names = DEMO_ROSTER.map((s) => `${s.firstName} ${s.lastName}`);
    expect(new Set(names).size).toBe(32);
    for (const essay of [...DEMO_DBQ_ESSAYS, ...DEMO_LANG_ESSAYS]) {
      expect(names).toContain(`${essay.studentFirstName} ${essay.studentLastName}`);
    }
  });

  it("includes long names for truncation testing", () => {
    expect(DEMO_ROSTER.some((s) => `${s.firstName} ${s.lastName}`.length >= 28)).toBe(true);
  });
});
