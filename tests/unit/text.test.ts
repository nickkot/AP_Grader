import { describe, expect, it } from "vitest";

import { cleanQuote, findQuote, joinPages, pageForOffset } from "@/lib/ai/quotes";
import { NAME_PLACEHOLDER, NUMBER_PLACEHOLDER, redactText } from "@/lib/ai/redact";
import { checkRowOutput, buildContextBlock, type RowOutput } from "@/lib/ai/score";
import { transcriptToText, transcriptStats } from "@/lib/ai/transcribe";
import { feedbackViolations, sentenceCount } from "@/lib/copy/banned";
import { parseRoster } from "@/lib/data";
import { tokenFromQr } from "@/lib/pipeline/run";
import { getRubric, rubricForEssayType } from "@/lib/rubrics";

describe("redactText", () => {
  const author = { firstName: "Maya", lastName: "Jackson" };
  const roster = [author, { firstName: "Daniel", lastName: "Reyes" }];

  it("removes roster full names in either order", () => {
    const out = redactText("Maya Jackson\nPeriod 3\nI worked with Daniel Reyes and Reyes, Daniel agreed.", author, roster);
    expect(out).not.toMatch(/Maya|Daniel/);
    expect(out).toContain(NAME_PLACEHOLDER);
  });

  it("keeps historical names that share the author's surname", () => {
    const essay = "Thesis here about the bank war and the period.\nIn 1832 Jackson vetoed the recharter of the bank, and Andrew Jackson called it a monster.";
    const out = redactText(essay, author, roster);
    expect(out).toContain("Jackson vetoed");
    expect(out).toContain("Andrew Jackson called");
  });

  it("removes the author's name in a short header line and after 'my name is'", () => {
    const out = redactText("Maya, period 3\nMy name is Maya and this essay argues that reform was moral.", author, roster);
    expect(out).not.toContain("Maya");
  });

  it("removes long ID numbers but keeps years", () => {
    const out = redactText("Student 4410293 wrote about 1848.", null, []);
    expect(out).toContain(NUMBER_PLACEHOLDER);
    expect(out).toContain("1848");
  });
});

describe("quotes", () => {
  const essay = "Douglass said “your shouts of liberty” were hollow.\n\nThe  women at Seneca Falls listed grievances.";

  it("finds quotes despite whitespace and curly quote differences", () => {
    expect(findQuote(essay, '"your shouts of liberty" were hollow')).not.toBeNull();
    expect(findQuote(essay, "The women at Seneca Falls")).not.toBeNull();
  });

  it("is case sensitive and rejects paraphrases", () => {
    expect(findQuote(essay, "the women at seneca falls")).toBeNull();
    expect(findQuote(essay, "Douglass said liberty was hollow")).toBeNull();
  });

  it("maps a quote to its page", () => {
    const { text, spans } = joinPages([
      { id: "b", pageNumber: 2, text: "Second page text here." },
      { id: "a", pageNumber: 1, text: "First page text here." },
    ]);
    const hit = findQuote(text, "Second page text");
    expect(pageForOffset(spans, hit!.start)?.pageNumber).toBe(2);
  });

  it("strips quote marks and ellipses the model adds", () => {
    expect(cleanQuote('"...the vote"')).toBe("the vote");
  });
});

describe("transcripts", () => {
  it("drops crossed-out words and marks illegible ones", () => {
    const lines = [{ words: [{ text: "The", confidence: 0.9 }, { text: "maki", confidence: 0.9, deleted: true }, { text: "", confidence: 0, illegible: true }] }];
    expect(transcriptToText(lines)).toBe("The [illegible]");
    expect(transcriptStats(lines).lowConfidenceCount).toBe(1);
  });
});

describe("row output checks", () => {
  const row = getRubric("apush-dbq", 1).rows[0];
  const good: RowOutput = {
    points: 1,
    justification: "Takes a defensible position and sets up two categories.",
    evidence_quotes: ["only partly expanded democratic ideals"],
    student_feedback: 'Thesis: earned. You wrote that reform "only partly expanded democratic ideals." Next time, name your two categories in the same sentence.',
    confidence: 0.9,
    borderline: false,
  };

  it("accepts well-formed feedback", () => {
    expect(checkRowOutput(row, good)).toEqual([]);
  });

  it("flags banned phrases, length and point range", () => {
    const bad = { ...good, points: 3, student_feedback: "Great job! Overall, this essay is strong. Be more specific. Elaborate further. Keep up the good work." };
    const issues = checkRowOutput(row, bad).join(" ");
    expect(issues).toMatch(/points/);
    expect(issues).toMatch(/banned/);
    expect(issues).toMatch(/at most 3 sentences/);
  });

  it("feedbackViolations catches exclamation marks and em dashes", () => {
    expect(feedbackViolations("Nice—really").length).toBeGreaterThan(0);
    expect(feedbackViolations("Good point!").length).toBeGreaterThan(0);
    expect(sentenceCount("One. Two. Three.")).toBe(3);
  });
});

describe("scoring context", () => {
  it("is byte-stable and never includes names it was not given", () => {
    const ctx = {
      rubric: rubricForEssayType("LANG_ARG"),
      courseLabel: "AP English Language",
      essayTypeLabel: "Argument essay",
      promptText: "Argue about failure.",
      sources: [],
      essayText: redactText("Maya Jackson\nFailure teaches more than success because it forces reflection.", { firstName: "Maya", lastName: "Jackson" }, [{ firstName: "Maya", lastName: "Jackson" }]),
      handwritten: true,
    };
    const a = buildContextBlock(ctx);
    expect(a).toBe(buildContextBlock(ctx));
    expect(a).not.toContain("Maya");
    expect(a).toContain("Never comment on spelling");
  });
});

describe("roster and QR parsing", () => {
  it("parses names in both formats and CSV", () => {
    expect(parseRoster("Maya Chen\nRivera, Daniel\nMary Ann Smith")).toEqual([
      { firstName: "Maya", lastName: "Chen" },
      { firstName: "Daniel", lastName: "Rivera" },
      { firstName: "Mary Ann", lastName: "Smith" },
    ]);
    expect(parseRoster("First Name,Last Name\nMaya,Chen")).toEqual([{ firstName: "Maya", lastName: "Chen" }]);
  });

  it("extracts tokens from QR payloads", () => {
    expect(tokenFromQr("https://app.example.com/q/ABCD2345EFGH")).toBe("ABCD2345EFGH");
    expect(tokenFromQr("hello world")).toBeNull();
  });
});
