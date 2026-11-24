/**
 * Rubric definitions.
 *
 * LICENSING: these are our own paraphrased decision rules, written to match
 * the structure of the AP rubrics (rows and point values). They are not
 * College Board text. `licensedTextRef` is the slot for licensed wording
 * once a license exists. See docs/LEGAL_TODO.md.
 *
 * Rubrics are versioned. Every score records the key and version it used.
 * Changing any rule below means adding a new version, never editing one in place
 * after it has scored essays.
 */

export type EssayType = "APUSH_DBQ" | "LANG_ARG";
export type Course = "APUSH" | "AP_LANG";

export type PointLevel = { points: number; rule: string };

export type RubricRow = {
  key: string;
  label: string;
  maxPoints: number;
  /** Short, student-friendly wording printed on the prompt page. */
  studentWording: string;
  /** What the scorer checks, in our own words. */
  decisionRules: string[];
  /** For rows worth more than one point: what each level requires. */
  levels?: PointLevel[];
  /** Common reasons the point is not earned. */
  notEarnedWhen: string[];
};

export type Rubric = {
  key: string;
  version: number;
  essayType: EssayType;
  title: string;
  maxPoints: number;
  rows: RubricRow[];
  /** Pointer to licensed rubric text, when we have a license. Null today. */
  licensedTextRef: string | null;
};

export const COURSES: Record<Course, { label: string; essayTypes: EssayType[] }> = {
  APUSH: { label: "AP U.S. History", essayTypes: ["APUSH_DBQ"] },
  AP_LANG: { label: "AP English Language", essayTypes: ["LANG_ARG"] },
};

export const ESSAY_TYPES: Record<
  EssayType,
  {
    label: string;
    shortLabel: string;
    course: Course;
    rubricKey: string;
    defaultTimeLimitMinutes: number;
    defaultReadingMinutes: number;
    usesSources: boolean;
    defaultAnswerPages: number;
  }
> = {
  APUSH_DBQ: {
    label: "Document-based question",
    shortLabel: "DBQ",
    course: "APUSH",
    rubricKey: "apush-dbq",
    defaultTimeLimitMinutes: 60,
    defaultReadingMinutes: 15,
    usesSources: true,
    defaultAnswerPages: 4,
  },
  LANG_ARG: {
    label: "Argument essay",
    shortLabel: "Argument",
    course: "AP_LANG",
    rubricKey: "lang-argument",
    defaultTimeLimitMinutes: 40,
    defaultReadingMinutes: 0,
    usesSources: false,
    defaultAnswerPages: 3,
  },
};

const APUSH_DBQ_V1: Rubric = {
  key: "apush-dbq",
  version: 1,
  essayType: "APUSH_DBQ",
  title: "APUSH document-based question",
  maxPoints: 7,
  licensedTextRef: null,
  rows: [
    {
      key: "thesis",
      label: "Thesis",
      maxPoints: 1,
      studentWording: "Make a claim that answers the question and sets up how you will argue it.",
      decisionRules: [
        "The essay makes a claim that answers the prompt and that a historian could defend with evidence.",
        "The claim sets up a line of reasoning: it signals the categories or reasons the essay will use.",
        "The claim sits in one place, either the introduction or the conclusion, and can be more than one sentence.",
      ],
      notEarnedWhen: [
        "It only restates or rephrases the prompt.",
        "It answers the prompt but gives no reasons or categories.",
        "The claim is scattered across the essay instead of stated in one place.",
      ],
    },
    {
      key: "contextualization",
      label: "Contextualization",
      maxPoints: 1,
      studentWording: "Describe the bigger historical picture around the question.",
      decisionRules: [
        "The essay describes broader developments that happened before, during or continuing after the period in the prompt.",
        "The context is connected to the topic of the prompt.",
        "It is a description of several sentences, not a single phrase or a passing mention.",
      ],
      notEarnedWhen: [
        "It names an event or era without describing it.",
        "The context is unrelated to the prompt's topic.",
      ],
    },
    {
      key: "document_evidence",
      label: "Evidence from the documents",
      maxPoints: 2,
      studentWording: "Use what the documents say to support your argument.",
      decisionRules: [
        "Count the documents whose content the essay describes accurately in its own words.",
        "Quoting a document without explaining what it shows does not count as describing it.",
      ],
      levels: [
        { points: 1, rule: "Accurately describes the content of at least three documents in a way that addresses the topic." },
        { points: 2, rule: "Uses the content of at least four documents to support an argument that responds to the prompt." },
      ],
      notEarnedWhen: [
        "Documents are listed or quoted but not explained.",
        "The description misreads what a document says.",
      ],
    },
    {
      key: "outside_evidence",
      label: "Evidence beyond the documents",
      maxPoints: 1,
      studentWording: "Bring in one specific piece of history that is not in the documents.",
      decisionRules: [
        "The essay uses at least one specific piece of historical evidence that does not appear in the documents.",
        "The evidence is described and connected to an argument about the prompt.",
        "It must be different from the evidence used for contextualization.",
      ],
      notEarnedWhen: [
        "The evidence is only named, with no description.",
        "The only outside evidence is the same material used for contextualization.",
        "The evidence comes from the documents.",
      ],
    },
    {
      key: "sourcing",
      label: "Sourcing",
      maxPoints: 1,
      studentWording: "For two documents, explain why who wrote it, why, when or for whom matters.",
      decisionRules: [
        "For at least two documents, the essay explains how or why the author's point of view, purpose, historical situation or audience matters to the argument.",
        "Identifying the author or date is not enough: the essay says why it matters.",
      ],
      notEarnedWhen: [
        "It names the source details without explaining their relevance.",
        "Only one document is sourced.",
      ],
    },
    {
      key: "complexity",
      label: "Complexity",
      maxPoints: 1,
      studentWording: "Show a complex understanding: weigh causes, compare, or explain change and continuity.",
      decisionRules: [
        "The essay shows a complex understanding of the historical development in the prompt.",
        "It uses evidence to corroborate, qualify or modify its argument, for example by weighing multiple causes, explaining both similarity and difference, explaining both continuity and change, or connecting to another period.",
        "The complexity runs through the argument. A single phrase or sentence is not enough.",
      ],
      notEarnedWhen: [
        "A counterargument is mentioned but not developed.",
        "Complexity appears in one sentence and is not supported with evidence.",
      ],
    },
  ],
};

const LANG_ARGUMENT_V1: Rubric = {
  key: "lang-argument",
  version: 1,
  essayType: "LANG_ARG",
  title: "AP Lang argument essay",
  maxPoints: 6,
  licensedTextRef: null,
  rows: [
    {
      key: "thesis",
      label: "Thesis",
      maxPoints: 1,
      studentWording: "Take a clear position on the question that someone could argue against.",
      decisionRules: [
        "The essay states a position on the prompt that can be defended with evidence and reasoning.",
        "The thesis can be anywhere in the essay and can be more than one sentence.",
      ],
      notEarnedWhen: [
        "It restates the prompt without taking a position.",
        "It summarizes the issue without arguing a side.",
        "It takes a position that does not answer the prompt.",
      ],
    },
    {
      key: "evidence_commentary",
      label: "Evidence and commentary",
      maxPoints: 4,
      studentWording: "Back every claim with specific evidence and explain how it proves your point.",
      decisionRules: [
        "Judge the specificity of the evidence and how well the commentary explains the link between evidence and claims.",
        "A line of reasoning means claims that build on one another toward the thesis.",
      ],
      levels: [
        { points: 0, rule: "Only restates the thesis, offers irrelevant material, or has no real evidence." },
        { points: 1, rule: "Evidence is mostly general, and the essay summarizes it without explaining how it supports the argument." },
        { points: 2, rule: "Some evidence is specific and relevant, and the essay explains how some of it relates to the argument, but there is no clear line of reasoning." },
        { points: 3, rule: "Specific evidence supports each claim in a line of reasoning, and the essay explains how some of that evidence supports the reasoning." },
        { points: 4, rule: "Specific evidence supports each claim in a line of reasoning, and the essay consistently explains how the evidence supports the reasoning." },
      ],
      notEarnedWhen: [
        "Evidence is hypothetical or vague where a specific example is needed.",
        "Commentary repeats the evidence instead of explaining it.",
      ],
    },
    {
      key: "sophistication",
      label: "Sophistication",
      maxPoints: 1,
      studentWording: "Go further: explore tensions, limits or the bigger picture, or write with real force.",
      decisionRules: [
        "The essay shows sophisticated thinking or a complex grasp of the rhetorical situation, in one or more of these ways: it explores tensions or complexities in the issue; it explains implications or limits of its own argument within a broader context; it makes rhetorical choices that consistently strengthen the argument; its style is consistently vivid and persuasive.",
        "The sophistication is sustained through the essay, not a single sentence.",
      ],
      notEarnedWhen: [
        "It only nods to the other side in a sentence.",
        "Big claims about the world are made without being developed.",
        "Vocabulary is elevated but the thinking stays simple.",
      ],
    },
  ],
};

const RUBRICS: Rubric[] = [APUSH_DBQ_V1, LANG_ARGUMENT_V1];

export function getRubric(key: string, version: number): Rubric {
  const rubric = RUBRICS.find((r) => r.key === key && r.version === version);
  if (!rubric) throw new Error(`Unknown rubric ${key} v${version}`);
  return rubric;
}

export function latestRubric(key: string): Rubric {
  const matches = RUBRICS.filter((r) => r.key === key).sort((a, b) => b.version - a.version);
  if (!matches[0]) throw new Error(`Unknown rubric ${key}`);
  return matches[0];
}

export function rubricForEssayType(essayType: EssayType): Rubric {
  return latestRubric(ESSAY_TYPES[essayType].rubricKey);
}
