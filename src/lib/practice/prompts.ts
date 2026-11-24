import type { SourceDocument } from "@/lib/db/schema";
import { DEMO_DBQ, DEMO_LANG } from "@/lib/demo/content";
import type { EssayType } from "@/lib/rubrics";

/**
 * The practice library. Prompts are original, written by us. DBQ documents are
 * public-domain excerpts with citations; every excerpt must be checked against
 * an archive copy before it ships. Versioned like rubrics: change the text, bump the version.
 *
 * Every prompt stays `teacherReviewed: false` until an experienced AP teacher signs it off
 * (docs/STUDENT_PRACTICE_PLAN.md, open question 3).
 */
export type PracticePrompt = {
  key: string;
  version: number;
  essayType: EssayType;
  title: string;
  promptText: string;
  sources: SourceDocument[];
  /** Course unit or AP period, used by the library filters. */
  unit: string;
  difficulty: "standard" | "challenging";
  teacherReviewed: boolean;
};

const ARGUE = "Use specific evidence from your reading, studies, experience or observation, and explain how your evidence supports your argument.";

function lang(key: string, title: string, framing: string, ask: string, difficulty: PracticePrompt["difficulty"] = "standard"): PracticePrompt {
  return {
    key,
    version: 1,
    essayType: "LANG_ARG",
    title,
    promptText: `${framing} Write an essay that argues your position on ${ask}. ${ARGUE}`,
    sources: [],
    unit: "Argument",
    difficulty,
    teacherReviewed: false,
  };
}

export const PRACTICE_PROMPTS: PracticePrompt[] = [
  {
    key: "dbq-reform-1820-1860",
    version: 1,
    essayType: "APUSH_DBQ",
    title: DEMO_DBQ.title,
    promptText: DEMO_DBQ.promptText,
    sources: DEMO_DBQ.sources,
    unit: "Period 4: 1800 to 1848",
    difficulty: "standard",
    teacherReviewed: false,
  },
  {
    key: "lang-value-of-failure",
    version: 1,
    essayType: "LANG_ARG",
    title: DEMO_LANG.title,
    promptText: DEMO_LANG.promptText,
    sources: [],
    unit: "Argument",
    difficulty: "standard",
    teacherReviewed: false,
  },
  lang(
    "lang-boredom",
    "The use of boredom",
    "Many families and schools try to fill every free hour of a young person's day with lessons, teams and screens. Others say that unscheduled, even boring, time is where independent thinking starts.",
    "the value of boredom",
  ),
  lang(
    "lang-traditions",
    "Keeping traditions",
    "Communities often keep traditions long after anyone remembers why they began.",
    "whether a tradition should be kept once its original purpose is no longer clear",
  ),
  lang(
    "lang-depth-or-breadth",
    "Depth or breadth",
    "Some people believe the best preparation for life is to master one field deeply. Others believe it is better to know something about many fields.",
    "the relative value of specialization and breadth",
    "challenging",
  ),
  lang(
    "lang-public-recognition",
    "Awards and recognition",
    "Schools, workplaces and communities hand out awards, rankings and public praise to encourage good work.",
    "whether public recognition improves the work people do",
  ),
  lang(
    "lang-convenience",
    "The cost of convenience",
    "Many inventions promise to save time and effort, from delivery apps to self-driving cars.",
    "whether convenience makes people's lives better",
  ),
  lang(
    "lang-disagreement",
    "Seeking disagreement",
    "It is easy to spend most of our time with people, news and media that share our views.",
    "whether people should deliberately seek out views they disagree with",
  ),
  lang(
    "lang-unfair-rules",
    "Unfair rules",
    "Every school, team and workplace has rules that some members think are unfair.",
    "the extent to which people should follow a rule they believe is unfair",
    "challenging",
  ),
  lang(
    "lang-impossible-goals",
    "Goals out of reach",
    "Some coaches and teachers urge people to set goals they will probably never reach. Others say realistic goals are the only useful kind.",
    "the value of setting goals you are unlikely to reach",
  ),
  lang(
    "lang-privacy",
    "Privacy and safety",
    "Cameras, location tracking and online records can make communities safer and services more convenient, but they also reveal a great deal about the people who use them.",
    "how much privacy people should be willing to give up for safety or convenience",
    "challenging",
  ),
];

export function practicePrompt(key: string): PracticePrompt | undefined {
  return PRACTICE_PROMPTS.find((p) => p.key === key);
}
