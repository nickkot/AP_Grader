import { describe, expect, it } from "vitest";

import { generateJoinCode, normalizeJoinCode, normalizeName } from "@/lib/join";
import { PRACTICE_PROMPTS } from "@/lib/practice/prompts";
import { PRACTICE_TIMING, timedWindow } from "@/lib/practice/timing";
import { BANNED_UI_WORDS } from "@/lib/copy/banned";

describe("join codes and names", () => {
  it("makes 6-character codes without look-alike characters", () => {
    for (let i = 0; i < 200; i++) expect(generateJoinCode()).toMatch(/^[23456789A-HJ-NP-Z]{6}$/);
  });

  it("reads codes typed with spaces, dashes or lowercase", () => {
    expect(normalizeJoinCode(" k7m-2qx ")).toBe("K7M2QX");
  });

  it("compares names without case, accents or punctuation", () => {
    expect(normalizeName("  José  O'Neil ")).toBe(normalizeName("jose oneil"));
    expect(normalizeName("Zoë")).toBe("zoe");
  });
});

describe("practice timing", () => {
  it("adds the reading period to the DBQ and none to the argument essay", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    expect(timedWindow("APUSH_DBQ", start)).toEqual({
      readingEndsAt: new Date("2026-01-01T10:15:00Z"),
      deadlineAt: new Date("2026-01-01T11:00:00Z"),
    });
    expect(timedWindow("LANG_ARG", start)).toEqual({ readingEndsAt: null, deadlineAt: new Date("2026-01-01T10:40:00Z") });
    expect(PRACTICE_TIMING.LANG_ARG.readingMinutes).toBe(0);
  });
});

describe("practice library", () => {
  it("has unique keys, cited sources and no banned words", () => {
    const keys = PRACTICE_PROMPTS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of PRACTICE_PROMPTS) {
      expect(p.promptText.length).toBeGreaterThan(80);
      for (const s of p.sources) expect(s.citation.length).toBeGreaterThan(10);
      if (p.essayType === "APUSH_DBQ") expect(p.sources.length).toBeGreaterThanOrEqual(6);
      const lower = p.promptText.toLowerCase();
      for (const w of BANNED_UI_WORDS) expect(lower).not.toMatch(new RegExp(`\\b${w}\\b`));
      expect(p.promptText).not.toMatch(/[!—]/);
    }
  });
});
