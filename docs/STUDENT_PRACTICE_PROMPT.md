# Claude Code Build Prompt: Student Practice

Run this in the same repo after the main build prompt (`docs/BUILD_PROMPT.md`) reaches at least milestone 5. It adds a student-facing practice space on top of the existing rubric engine, scoring pipeline, accounts and skills.

## Role and how to work

You are adding a student practice product to an existing AP essay grading platform. Reuse what already exists: the rubric engine, scoring pipeline, handwriting capture, course catalog, accounts, entitlements and the skills in `.claude/skills/`. Do not build a second scoring system.

Work this way:

1. Read this prompt and the existing `docs/PLAN.md`, `docs/DECISIONS.md` and data model. Then write `docs/STUDENT_PRACTICE_PLAN.md` with the new screens, data model changes, milestone tasks and open questions. Stop and show me the plan before building.
2. Build in the milestones below. Each ends with passing tests, a seeded demo student and a `docs/CHANGELOG.md` entry.
3. Every rule in the main prompt still applies, including the required skills, privacy rules and the accuracy harness.

## What this is

A place where AP students practice timed essays on their own, get scored point by point against the AP rubric, and see exactly what to fix next. It should feel like a calm practice room, not a game and not a chatbot.

Courses at launch: AP U.S. History, AP English Language, AP English Literature, AP U.S. Government and Politics. Same course catalog as the teacher product. AP Economics stays out of scope.

The one rule that shapes everything: the product scores and coaches student writing. It never writes the essay for the student. No generated thesis statements, paragraphs, rewrites or "model answers" built from the student's own draft. This keeps it useful for learning and keeps schools comfortable recommending it.

## Who uses it

- School-linked students: students in a class whose teacher or school uses the platform. Practice is included in the school's license, and teachers can see it (see "Teacher visibility").
- Independent students: students who sign up on their own, with no school account. They pay through a parent (see "Accounts and payment").

Both use the same practice space. What differs is who can see their work and who pays.

## Features

### 1. Practice library

- Original practice prompts we write for every essay type in each launch course: APUSH DBQ, LEQ and SAQ; Lang Synthesis, Rhetorical Analysis and Argument; Lit Poetry, Prose and Literary Argument; Gov Concept Application, Quantitative Analysis, SCOTUS Comparison and Argument Essay.
- DBQ and synthesis prompts come with original or public-domain source documents. No College Board prompts, documents or released essays without a license (add to `docs/LEGAL_TODO.md`).
- Filter by course, essay type, unit, historical period, skill and difficulty.
- Teachers can push assignments from the teacher product into a student's practice queue.
- Mark which prompts a student has already done, so they can choose new ones or redo old ones.

### 2. Writing modes

- Timed practice: real AP timing per essay type, a countdown, and auto-submit when time runs out. Reading periods included where the real exam has them.
- Untimed practice: same prompt and rubric, no clock, for working on one skill at a time.
- Skill drills: short focused tasks scored on one rubric row only (for example, write just a thesis and contextualization for a DBQ prompt, in 10 minutes).
- Full practice exam: all free-response questions for one course, back to back, with real section timing.

### 3. Ways to submit

- Type in the app: a clean, distraction-free editor with autosave, word count and the sources beside it. No spell check or grammar suggestions during timed practice, to match the real exam.
- Handwrite and photograph: the student writes on paper, as on most AP exams, then photographs the pages on their phone. Reuse the existing capture, cleanup, transcription and verification flow. The student confirms the transcription before scoring, and transcription errors never count against them.
- Printable practice sheets: prompt plus lined answer pages with QR codes, reusing the teacher packet generator.

### 4. Scoring and feedback

- Score with the existing pipeline: point by point against the course rubric, with a score per row, a quote from the student's essay as evidence, and one concrete next step.
- Follow the `student-feedback-writing` skill strictly. Student-facing feedback is short, specific and written at a grades 9-10 reading level.
- Show results fast: target under 60 seconds for a typed essay.
- Show the total as the AP rubric score (for example, 5 of 7), never as a predicted AP exam score from a single essay.
- Every practice score is labeled as a practice estimate, not an official or teacher score.
- Low-confidence rows are shown as "We're not sure about this one" with a suggestion to ask a teacher, not presented as certain.

### 5. Coaching without writing for them

- Explain the rubric: for any row, a plain-language explanation of what earns the point, with short annotated examples written by us (never the student's own essay rewritten).
- Ask why: the student can ask a follow-up question about a specific piece of feedback ("Why didn't my contextualization count?"). Answers explain and point to their own words, Socratic style. They do not produce replacement sentences.
- Revise and resubmit: the student revises the same essay and sees which rows changed. Revision history is kept so they can see their progress on one essay.
- Hard guardrails, enforced in prompts and tested in CI:
  - Never generate a thesis, paragraph, outline or full essay for the student's prompt.
  - Never rewrite the student's sentences.
  - If asked to write for them, decline in one plain sentence and offer a hint or a question instead.
  - Add red-team tests with 50+ attempts to get the coach to write the essay, including indirect ones ("show me what a 7 looks like for my prompt"). All must pass.

### 6. Progress and growth

- A progress page per course: score trend over time, and rubric-row mastery (for example, "Contextualization: earned in 3 of your last 5 DBQs").
- "What to work on next": the one or two rubric rows holding the student back most, with a matching skill drill.
- Streaks and goals are optional and quiet: a weekly practice goal the student sets, no points, badges, leaderboards or confetti.
- Practice history: every essay with its prompt, pages or text, scores, feedback and revisions. Ties into the student portfolio from the main platform.
- Before the exam: a readiness view showing rubric-row mastery across essay types, clearly labeled as a guide, not a predicted score.

### 7. Teacher visibility (school-linked students)

- Teachers see practice activity for students in their classes: essays completed, rubric-row trends and recent feedback. District settings control this, and it is on by default for school-linked students.
- Students see a clear note on their practice home saying their teacher can see their practice work.
- Practice scores never go to the gradebook or SIS unless the teacher assigned that practice and chooses to grade it.
- Teachers can flag a practice essay to review together, and add their own comments, which show as teacher comments.
- Department and district analytics from the main platform include practice data by course, so AP coordinators see where students are practicing and improving.

### 8. Accounts, age and payment

- School-linked students: join through the class code, QR code, Clever, ClassLink or roster sync already in the platform. Practice is covered by the school license through the entitlements service.
- Independent students:
  - Must be 13 or older. Ask for date of birth at sign-up through a neutral age screen; under 13 cannot create an independent account.
  - Students under 18 need a parent or guardian account to pay and to give consent. The parent account handles billing, can see practice history and progress, and can delete the student's data.
  - Plans: a free tier (for example, 3 scored essays a month and all skill drills) and a paid student plan billed monthly or for the school year, through Stripe.
  - An independent student can later join a school class without losing their history; they choose whether to share past practice with the teacher.
- Collect only what is needed: no demographic questions, no ads, no selling or sharing data, no training on student essays. Same privacy rules as the main prompt, plus state student-privacy laws for consumer accounts. Update `docs/LEGAL_TODO.md` with the consumer terms and privacy policy needed.

### 9. Student experience

- Mobile first: many students will practice and photograph pages on a phone. The typed editor must also work well on a Chromebook.
- Follow the `design-system`, `product-voice`, `ux-simplicity-review` and `visual-qa` skills. The student side uses the same calm style as the teacher side, with a little more breathing room in reading views.
- Click budgets:
  - Start a timed practice essay from the home screen: 2 taps.
  - Submit photographed pages after the camera opens: 1 tap per page, 1 to finish.
  - See results after submitting: 0 extra taps (results open when ready).
  - Start the recommended next drill: 1 tap.
- Copy speaks to students directly and plainly ("Your thesis earned the point. Contextualization didn't, here's why."). No hype, no cheerleading, no exclamation marks, no em dashes.
- Accessibility: WCAG 2.1 AA, screen reader support, adjustable text size, and extended-time settings for students with accommodations (set by their teacher or parent).

### 10. Safety and integrity

- No open-ended chatbot. The only AI the student talks to is the feedback "Ask why" feature, limited to their essay and its rubric.
- Moderation on all student text input: if an essay or question shows signs of self-harm, abuse or threats, do not score it as normal. Show the student a short, caring message with appropriate support resources, and, for school-linked students, follow the district's configured alert process. Document this flow in `docs/security/student-safety.md` and have it reviewed before launch.
- Rate limits per student to prevent abuse and control cost.
- Practice essays submitted through the student side are never shared with other students.

## Milestones

1. Practice core: practice library with seed prompts for APUSH DBQ and Lang Argument, typed editor with timed and untimed modes, scoring with existing pipeline, student results page.
2. Coaching guardrails: "Explain the rubric," "Ask why," revise and resubmit, plus the red-team test suite. Do not move on until every guardrail test passes.
3. Handwriting for students: phone capture, transcription confirmation and printable practice sheets, reusing the teacher capture flow.
4. All essay types and drills: remaining APUSH, Lang, Lit and Gov essay types, skill drills, full practice exams.
5. Progress: progress page, "what to work on next," weekly goals, readiness view, portfolio link.
6. Teacher visibility: teacher view of practice, comments, assigned practice into the gradebook, practice data in department and district analytics.
7. Independent students: age screen, parent accounts, consent, Stripe student plans, free tier limits, joining a school later.
8. Safety and hardening: moderation and alert flow, rate limits, load test for the April and May peak, accessibility audit.

## Definition of done for the first release (milestones 1-3)

- A student can pick an APUSH DBQ or Lang Argument prompt, write it timed on a laptop or on paper, submit, and see row-by-row scores with quotes from their own essay and one next step, in under 2 minutes for typed essays.
- The student can ask why a row was scored the way it was, revise and resubmit, and see what changed.
- Every red-team attempt to get the product to write or rewrite the essay fails.
- No feedback text contains banned phrases from `student-feedback-writing`, and every quoted piece of evidence appears verbatim in the student's essay (tested).

## First response I expect from you

1. `docs/STUDENT_PRACTICE_PLAN.md` with new screens, data model changes (reuse existing tables where possible), milestone tasks and estimates.
2. Open questions, especially on independent-student consent, the practice prompt library, and how practice data appears to teachers.
3. Nothing else until I approve the plan.
