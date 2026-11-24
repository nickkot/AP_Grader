# Student practice: build plan

Status: **approved 2026-11-24. P1 (practice core) built.** Next: P2 (coaching guardrails and moderation), which must ship before any real student uses practice. Answers taken for the open questions are in section 11.

Source spec: `docs/STUDENT_PRACTICE_PROMPT.md`. Builds on `docs/PLAN.md` and the teacher MVP (branch `mvp/handwritten-loop`).

---

## 1. Principles

1. **One scoring system.** Practice essays go through the same pipeline as teacher assignments: the same rubric versions, the same per-row scoring call, quote check, confidence and flags. Practice adds a context flag and a student-facing presentation, nothing more.
2. **Coach, never author.** No AI output on the student side may contain new essay prose for the student's prompt. This is enforced in three places: the prompts, an output guard that runs after every coach response, and a red-team suite in CI.
3. **Static where possible.** "Explain the rubric" is written by us and stored as content, not generated. The only generated text a student sees is (a) per-row feedback from the scoring pipeline and (b) "Ask why" answers. Both pass through the same guard.
4. **Practice is not grading.** Every practice score is labeled a practice estimate. It never reaches a gradebook or SIS unless a teacher assigned that practice and chooses to grade it.

---

## 2. Dependencies on the teacher product

| Needs | From teacher milestone | Notes |
| --- | --- | --- |
| Rubric engine, per-row scoring, quote check | MVP / M2 | Already in the MVP build |
| Handwriting capture, QR sheets, transcription, verification | MVP / M2 | Reused as-is, with the student as uploader |
| Course catalog, all essay types | M4, M4b | Practice M4 depends on these and their benchmarks |
| Student accounts (class code, QR, Clever, ClassLink) | M5, M7 | Practice M1 needs class-code sign-in at minimum |
| Entitlements, Stripe | M8 | Practice M7 (independent students) depends on it |
| Department and district analytics | M7 | Practice M6 extends them |

The spec says to start after teacher M5. If you want students practicing sooner, practice M1 to M3 could start right after the teacher MVP. The cost would be pulling student sign-in (class code only) forward from teacher M5. See open question 1.

---

## 3. Screens

Student side (mobile first; typed editor tuned for Chromebooks):

| Screen | Job | Notes |
| --- | --- | --- |
| Practice home | Start the next essay | One primary button: the recommended next practice or the teacher-pushed item. Note "Your teacher can see your practice work" for school-linked students. Weekly goal (optional, quiet). 2 taps to a timed essay: home, then "Start timed essay" on the prompt |
| Library | Pick a prompt | Table-style list with filters (course, essay type, unit, period, skill, difficulty, done or not done). Prompt detail opens in a side sheet with "Start timed," "Start untimed," "Print practice sheet" |
| Writing room | Write | Prompt and sources beside the editor (tabs on phones). Countdown with reading period, autosave every 5 seconds, word count, spellcheck off in timed mode, auto-submit at zero. Extended-time multiplier applied when set |
| Paper submit | Photograph pages | Reuses the teacher capture view and the transcription confirm screen, worded for students |
| Results | See what to fix | Opens automatically when scoring finishes (0 extra taps). Total as "5 of 7 (practice estimate)," then one block per row: verdict, quote, next step. Low-confidence rows say "We're not sure about this one. Ask your teacher to check it." Buttons per row: "Explain this row," "Ask why." Page-level: "Revise this essay" |
| Explain this row | Learn the rubric | Static content per rubric row: what earns the point, two short annotated examples written by us |
| Ask why | Question one piece of feedback | Thread tied to one row score. Answers quote the student's own words and ask a guiding question. Limited to 5 questions per row per attempt |
| Revision compare | See what changed | Side-by-side rows from version to version: earned, lost, unchanged |
| Progress (per course) | See trends | Score trend, row mastery ("Contextualization: earned in 3 of your last 5 DBQs"), "What to work on next" with a 1-tap drill |
| Readiness | Pre-exam view | Row mastery across essay types, labeled "A guide, not a predicted score" |
| History | Every attempt | Links into the student portfolio |
| Practice exam | Full FRQ section | Back-to-back questions with section timing, one results page per question |

Teacher side:

| Screen | Job |
| --- | --- |
| Class practice tab | Per student: essays completed, row trends, recent feedback, flagged essays |
| Practice essay view | Read the essay and scores, add teacher comments, flag "review together" |
| Push to practice | From an assignment or the library: add prompts to students' practice queues |
| Grade assigned practice | Choose to send an assigned practice score to the gradebook |

Parent side (M7): sign up, link and consent, billing, view progress and history, delete student data.

---

## 4. Data model changes

Reuse first. The teacher MVP already has `student`, `submission`, `page`, `score_run`, `row_score`, rubric versions and `qr_token`.

### Changes to existing tables

| Table | Change |
| --- | --- |
| `submission` | Add `context` (`assignment` or `practice`), make `assignment_id` nullable, add `practice_attempt_id`. A practice submission is scored exactly like an assignment submission |
| `score_run` | Add `context` (copied from submission) so analytics can split practice from graded work. Add `drill_row_keys` (score only these rows for drills) |
| `row_score` | No change. Student-facing feedback field already exists |
| `student` | Add `user_id` (student login), `account_kind` (`school_linked`, `independent`), `accommodation_time_multiplier` |
| `qr_token` | Add `practice_attempt_id` for printable practice sheets |
| `user` | Add `kind` (`staff`, `student`, `guardian`) |

### New tables

| Table | Key fields |
| --- | --- |
| `practice_prompt` | course, essay_type, title, prompt_text, sources (JSON, each with license status: original or public domain plus citation), unit, period, skills[], difficulty, author_scope (`internal`, `district`, `teacher`), status, version |
| `rubric_row_explainer` | rubric_row_key, version, plain_explanation, examples JSON (short annotated examples we write) |
| `practice_attempt` | student_id, practice_prompt_id, mode (`timed`, `untimed`, `drill`, `exam`), drill_row_keys, input_kind (`typed`, `handwritten`), started_at, reading_ends_at, deadline_at, submitted_at, auto_submitted, revision_of_attempt_id, revision_number, assigned_by_teacher_id, practice_exam_id |
| `attempt_draft` | attempt_id, text, saved_at, client_seq (autosave, last-write-wins with sequence check) |
| `practice_exam` | student_id, course, started_at, section timing, status |
| `practice_queue_item` | student_id, practice_prompt_id, pushed_by_teacher_id, class_id, due_at, done_at |
| `ask_why_message` | row_score_id, student_id, role (`student`, `coach`), text, guard_result, moderation_result, model, tokens, created_at |
| `teacher_practice_comment` | attempt_id, row_score_id (optional), teacher_id, text, flagged_for_review |
| `practice_goal` | student_id, essays_per_week, active |
| `guardian` / `guardian_link` | guardian user_id, student_id, consent_version, consent_method, consented_at, revoked_at |
| `age_screen` | user_id, birth_month, birth_year, result (`under_13_blocked`, `13_to_17`, `18_plus`), at. Full date of birth is not stored |
| `safety_event` | student_id, source (essay, ask_why), category, severity, action_taken, alerted_contacts, reviewed_by, at. Restricted access |
| `practice_usage` | student_id, month, scored_essays, ask_why_count (for free-tier limits and rate limits) |

Practice data stays in the same tenant as the student. Independent students get a personal tenant, as independent teachers do. Joining a school later reuses the tenant-move job, and the student picks which past attempts become visible to the teacher (`practice_attempt.shared_with_school`).

---

## 5. Guardrails (the part that must not fail)

**Where AI text appears on the student side:**
1. Row feedback from the scoring pipeline (already constrained by `student-feedback-writing`).
2. "Ask why" answers.

**Layers:**
1. **Prompt rules.** System prompt for "Ask why": explain using the rubric and the student's own quoted words; ask one guiding question; never write a thesis, sentence, paragraph, outline or example for the student's prompt; never rewrite their sentences; if asked to write, decline in one plain sentence and offer a hint or a question.
2. **Output guard (runs on every coach response before it is shown).** Deterministic checks: (a) any span of 12 or more words that is not a quote from the student's essay, the prompt, the sources or our rubric explainer is treated as possibly new essay prose and sent to (b); (b) a Haiku 5.5 classifier with a strict schema answers "Does this text supply essay content the student could paste in?" On a fail, the response is replaced with the standard decline and logged.
3. **Input screen.** Requests that ask for writing ("write my thesis," "show me a 7 for this prompt," "rephrase my intro") get the decline plus a hint without calling the coach model at all, when the classifier is confident.
4. **Red-team suite.** At least 60 attempts in `tests/redteam/` across direct asks, indirect asks ("what would a 7 look like for my prompt"), role-play, "fix my grammar" on a whole paragraph, translation tricks, asking for "an example from a different essay" on the same prompt, multi-turn escalation, and prompt injection inside the essay text. Runs in CI on every change to coach prompts, guards or models, and nightly. Any single failure fails the build.
5. **Feedback checks** already required by the skill: banned phrases, verbatim quotes, length and reading level.

**Moderation.** Every essay and every "Ask why" question goes through a moderation classifier (Haiku 5.5, strict schema: none, self-harm, abuse disclosure, threat to others) before scoring. A flagged essay is not scored. The student sees a short, caring message with support resources (988 Suicide and Crisis Lifeline and similar). For school-linked students the district's configured alert contacts are notified. The flow, wording and contacts are documented in `docs/security/student-safety.md` and reviewed before launch.

---

## 6. Speed: typed results in under 60 seconds

- All rows score in parallel (6 rows for a DBQ, 3 for Lang), sharing a cached prefix.
- Practice runs skip the Batch API, which is too slow for this.
- Results page subscribes to status updates and opens as soon as the last row lands.
- Expected time: about 15 to 30 seconds on Sonnet 5.5 at medium effort, measured in practice M1. If p95 is above 60 seconds, drop to low effort for practice runs and check that agreement holds on the benchmark.

---

## 7. Milestones

Estimates are calendar weeks for one person with Claude Code. Each milestone ends with passing tests, a seeded demo student and a `docs/CHANGELOG.md` entry; UI work also gets `ux-simplicity-review` and `visual-qa`.

| # | Milestone | Weeks | Key tasks |
| --- | --- | --- | --- |
| P1 | Practice core | 3 | Student sign-in by class code; `practice_prompt` with 10 original APUSH DBQ and 10 Lang Argument prompts (sources public domain); library with filters; writing room (timed with reading period, untimed, autosave, auto-submit, spellcheck off); scoring through the existing pipeline with `context = practice`; results page with practice labels and low-confidence wording |
| P2 | Coaching guardrails | 3 | Rubric explainers for both MVP rubrics; "Ask why" with prompt rules, output guard, input screen; revise and resubmit with row comparison; red-team suite (60+) in CI; moderation on essays and questions. Gate: all red-team tests pass |
| P3 | Handwriting for students | 1.5 | Student capture flow reusing the teacher one; transcription confirm; single-student printable practice sheet from the packet generator |
| P4 | All essay types and drills | 4 | Prompts for every essay type in the four courses (after teacher M4 and M4b benchmarks pass); skill drills scored on chosen rows; full practice exams with section timing |
| P5 | Progress | 2 | Progress page, "what to work on next" with 1-tap drill, weekly goal, readiness view, portfolio link |
| P6 | Teacher visibility | 2.5 | Class practice tab, practice essay view, teacher comments and flags, push to practice queue, grade assigned practice, practice data in analytics, district visibility setting |
| P7 | Independent students | 4 | Age screen (birth month and year only), guardian accounts and consent, Stripe student plans, free tier limits through entitlements, joining a school later with per-attempt sharing choice |
| P8 | Safety and hardening | 3 | Alert flow per district, `docs/security/student-safety.md` review, per-student rate limits, load test for April and May (target: 20,000 typed essays per day), accessibility audit including adjustable text size and extended time |

**First release (P1 to P3): about 7.5 weeks.** Total: about 23 weeks.

---

## 8. Cost per practice essay

Same pipeline as the teacher side: about $0.13 for a typed DBQ, about $0.15 handwritten (no Batch discount, since results must be fast). Each "Ask why" answer is about $0.01 to $0.02 on Sonnet 5.5, plus under $0.001 for the guard. Free tier at 3 essays a month costs us about $0.50 per free student per month.

---

## 9. Legal additions (to `docs/LEGAL_TODO.md`)

- Consumer terms of service and privacy policy for independent students and guardians.
- Verifiable guardian consent method for students 13 to 17, and state consumer student-privacy laws (for example California SOPIPA and CCPA, and similar laws in other states).
- Public-domain status and citation for every source document in the practice library.
- Support resources and wording in the safety flow reviewed by a counselor or child-safety advisor.

---

## 10. Open questions

1. **Timing.** The spec says to start after teacher M5. Do you want practice P1 to P3 to start right after the teacher MVP instead? That means pulling class-code student sign-in forward.
2. **Guardian consent for 13 to 17 year olds.** Options: (a) guardian creates the account and invites the student, (b) student starts, guardian confirms by email, then pays, (c) guardian payment through Stripe counts as consent. I recommend (b) with consent recorded before any essay is scored. Legal review needed either way.
3. **Prompt library authorship.** Who writes the practice prompts? I can draft original prompts and select public-domain sources, but an experienced AP teacher should review each one before it is published. Do you have a reviewer, and how many prompts per essay type at launch (I suggest 10 for each MVP type)?
4. **What teachers see.** Default proposal: teachers see all practice by students in their classes from the day they joined the class, but not practice done before joining unless the student shares it. Is that right? Should teachers see "Ask why" threads, or only scores and feedback?
5. **Does practice count against the school's license?** Proposal: unlimited practice for school-linked students, with a soft per-student monthly cap (for example 40 essays) to control cost.
6. **"Ask why" limit.** Proposal: 5 questions per rubric row per attempt, 30 per day. OK?
7. **Safety alerts.** Who receives alerts for school-linked students (counselor, AP coordinator, district contact)? For independent students under 18, do we notify the guardian?
8. **Exam timing table.** I'll store real AP timing per essay type as data and check it against the current College Board exam descriptions before P1. Do you want a teacher to sign off on those numbers?
9. **Independent students at launch.** Do you want independent (paid) students in the first public release, or school-linked only at first? School-linked only removes P7 from the critical path.

---

## 11. Answers taken (2026-11-24)

The plan was approved by choosing the full practice plan. Where a question was open, the plan's own recommendation was taken. Each can still be changed.

| # | Question | Answer taken |
| --- | --- | --- |
| 1 | Timing | Start now, right after the teacher MVP. Class-code sign-in was pulled forward into P1 |
| 2 | Guardian consent | Not needed until P7 (independent students). School-linked students only until then |
| 3 | Prompt authorship | We draft. P1 ships 10 AP Lang argument prompts and 1 APUSH DBQ (the demo one). Every prompt is marked `teacherReviewed: false` until an AP teacher signs it off. 9 more DBQs are needed, each with archive-checked documents |
| 4 | What teachers see | Default stands: practice after the student joined the class. Built in P6. The join page and practice home already tell students their teacher can see their practice |
| 5 | License | Unlimited for school-linked students later; P1 caps each student at 10 scored essays a day |
| 6 | "Ask why" limit | 5 per row per attempt, 30 a day (P2) |
| 7 | Safety alerts | Not answered. Needed before P2 ships |
| 8 | Exam timing | Stored as data in `src/lib/practice/timing.ts` (DBQ: 15-minute reading period plus 45 minutes; Argument: 40 minutes). A teacher should check them against the current Course and Exam Description |
| 9 | Independent students at launch | School-linked only at first. P7 is off the critical path |

### What P1 built

- Student accounts: `user.kind` is `teacher` or `student`. Students join at `/join` with the class code shown on the class page, then give their name as the teacher has it (or their number in a numbered class). The roster is never shown to them. 10 failed tries per hour at most.
- Practice library with 11 prompts, filters by course and status.
- Writing room: timed (reading period, countdown, auto-submit at zero, spell check off) and untimed; autosave every 5 seconds with a sequence number so an older save never overwrites a newer one; only the saved draft counts after time is up.
- Scoring through the same pipeline: a practice essay is a `submission` with `context = practice`, scored by the same per-row call, quote check and flags. The student's own name is redacted before scoring.
- Results with "practice estimate" labels, quotes from the student's essay, one next step per row, and "We are not sure about this one" on low-confidence rows.
- Teacher side: class code and "joined" count on the class page, a Joined pill per roster row.

### Not yet, and why it matters

- **No moderation yet (P2).** An essay that discloses self-harm or abuse is scored like any other. Do not open practice to real students before P2.
- **No "Ask why", explainers or revisions (P2).**
- **No handwritten practice (P3).**
- **Practice prompts live in code**, versioned like rubrics. A `practice_prompt` table comes when teachers or districts write prompts.
