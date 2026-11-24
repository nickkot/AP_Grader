# Launch plan: from working MVP to a product teachers use

Status: draft for review (2026-11-24). Builds on `docs/PLAN.md` (full product), `docs/DEPLOY.md` (hosting steps) and `docs/LEGAL_TODO.md`.

The goal of this plan is narrow: **3 to 5 AP teachers grade real timed writes with the app, trust the scores, and want to keep using it.** Everything past that (districts, billing, more courses) waits until the pilot says it is worth building.

## Where things stand

Working today, with tests:

- Classes from a pasted roster, or listed by number with no names stored. A named class can switch to numbers.
- Assignments for APUSH DBQ and AP Lang Argument. Packet PDF with QR-coded answer sheets.
- Upload from a phone (scan a code on the computer, no sign-in on the phone), a photo picker, or a copier PDF.
- Pages matched by QR code, printed names blanked before any model reads the page, transcription check, per-row scoring with verified quotes, review with keyboard shortcuts, CSV export.
- A How it works page for teachers.

Not there yet:

- Not deployed anywhere. Real-model scores have never been measured against human AP readers.
- No error monitoring, no rate limiting, no database row-level security, no way to delete a class and its photos.
- No privacy policy, terms or data agreement. Zero data retention with Anthropic is not confirmed.

## Step 0. Decisions only you can make (this week)

These block later steps. Each one is a short answer.

1. **Name and domain.** The name should not use "AP" (College Board trademark). The domain decides `APP_URL`, Google sign-in setup and the QR links.
2. **Anthropic account.** Create the organization, confirm commercial terms (no training on inputs), and request zero data retention. Check that every API feature we use is covered by it.
3. **Pilot teachers.** Name 3 to 5 AP teachers (APUSH or AP Lang) and the LMS each one uses.
4. **Benchmark.** Approve the stopgap from `docs/PLAN.md`, open question 2: write 30 to 50 original essays per essay type and pay 2 or 3 experienced AP readers to score them. Budget a few hundred dollars per reader.
5. **Default roster mode for the pilot.** Recommendation: numbers, so no student names are stored during the pilot. Teachers keep their own key.

## Step 1. Put it online, privately (about 1 week)

Follow `docs/DEPLOY.md`. In order:

1. Create accounts: Vercel, Neon (US), AWS (S3 bucket with SSE-KMS), Inngest, Google Cloud (OAuth client), Anthropic.
2. Set the production variables from `docs/DEPLOY.md` section 4. The app refuses to start on a public URL with fake models, in-process jobs, local storage or dev login, so a wrong setting fails loudly.
3. Run migrations against Neon (`npm run db:migrate`), including `0001_phone_link` and `0002_numbered_rosters`.
4. Point the domain at Vercel and lock preview deployments behind Vercel Authentication.
5. Add error monitoring (Sentry) and an alert for failed jobs (pages that fail to process, scoring runs that fail).
6. Turn on Neon point-in-time restore and S3 versioning. Write down how to restore.
7. Smoke test on the real domain, with a real phone:
   - Sign in with Google. Create a numbered class and a DBQ. Print the packet.
   - Hand-write two pages. On the computer choose Upload photos, then Show code, and photograph them with the phone.
   - Check the transcription, score, review, approve, export CSV.

Done when: the smoke test passes on the production domain, and an alert fires when you break something on purpose.

Note: the phone camera page needs https, which the production domain gives you. On a laptop at home, the phone link only works if `APP_URL` is set to the computer's network address, and the in-app camera needs https there too. The photo picker works without it.

## Step 2. Prove the scores (about 3 weeks, in parallel with step 3)

This is the step that decides whether teachers can trust the app. It is milestone M3 in `docs/PLAN.md`.

1. Write the stopgap essays: 30 to 50 per type, across the score range, some handwritten and scanned so transcription is measured too.
2. Have 2 or 3 AP readers score every essay row by row. Record where readers disagree with each other: that is the ceiling for the app.
3. Build the accuracy runner: score the set with the current prompts and models (batch mode, half price), then report per row:
   - exact agreement and agreement within 1 point with the readers
   - quadratic weighted kappa
   - average bias (does it score high or low?)
   - transcription word error rate on the handwritten set
4. Run the fairness check: insert identity cues into essays and confirm scores and comments do not move beyond a set tolerance.
5. Add a CI gate: any change to prompts, rubrics or model settings reruns the set and fails if agreement drops.
6. Log real cost per essay and per class set, and replace the estimates in `docs/PLAN.md`.

Done when: you set target numbers (a starting point: within 1 point on at least 95% of rows, and app-to-reader agreement no worse than reader-to-reader), and both essay types meet them. Rows that miss get prompt work or a stronger model for that row only.

## Step 3. Privacy and safety minimum for real student work (about 2 weeks)

Teachers will be uploading minors' writing. Before the first real class set:

1. **Policies.** Privacy policy, terms, and a data agreement template covering FERPA, COPPA and state laws such as California's SOPIPA. Publish the subprocessor list: Vercel, Neon, AWS, Inngest, Anthropic, Google.
2. **Deletion.** Add "Delete class" (removes students, essays, scores and page photos from the database and S3) and an automatic cleanup of page photos after the school year. Teachers and districts will ask for both.
3. **Rate limits.** On sign-in, on the phone upload link (pages per minute), and on scoring runs per teacher per day.
4. **Row-level security.** Add Postgres row-level security as a second guard behind the app's own ownership checks, with a test that one teacher can never read another's data.
5. **Dependencies.** Resolve the high-severity `npm audit` findings and run the license check in `docs/LEGAL_TODO.md`.
6. **Zero data retention** confirmed in writing by Anthropic (from step 0).

Done when: every item in `docs/LEGAL_TODO.md` under "Student data" is checked off.

## Step 4. Pilot with 3 to 5 teachers (4 to 6 weeks)

1. **Onboard each teacher in a 20-minute call.** Create their class together (numbers recommended), walk through How it works, print one packet.
2. **Two real timed writes per teacher**, graded end to end in the app. Teachers keep grading their usual way for one of them, so you can compare.
3. **Measure, per teacher and per essay type:**
   - minutes per essay in the app compared with by hand
   - share of rubric rows the teacher changed before approving (the real accuracy number)
   - transcription edits per page, pages that failed or needed matching
   - cost per essay
4. **One feedback channel** (a shared doc or email thread) and a weekly fix release. Read every changed score and every edited comment: they show where prompts are wrong.
5. **Exit interview** at the end: would you pay for this, what is missing, what nearly made you stop.

Done when: teachers save time on every timed write, change fewer than about 1 in 10 rows, and at least 3 of 5 want to keep using it.

## Step 5. Build what the pilot asks for (ordered by likely need)

Re-order this list after the pilot. Each item is sized for one person with Claude Code.

1. **Draft prompts and DBQ documents with Claude** (about 1 week). Teacher enters a topic and time period; Claude drafts the prompt and documents from real primary sources (web search and fetch restricted to archives such as loc.gov, archives.gov and avalon.law.yale.edu). Every excerpt is checked word for word against the fetched page and keeps its source link; anything that fails is marked for the teacher. Uses `claude-opus-5-5` through the existing Anthropic client. No student data is sent.
2. **Share feedback with students** (about 2 weeks). Today approved comments only reach students through the CSV. A per-student feedback page or printout is the most likely pilot request.
3. **LMS roster import and grade passback** for whichever LMS the pilot uses (Google Classroom first is likely). Milestone M5.
4. **More essay types**, each released only after it passes the benchmark: APUSH LEQ and SAQ, AP Lang Synthesis and Rhetorical Analysis. Milestone M4.
5. **Prompt library** so teachers reuse assignments across sections and years.
6. **Known limits** in `docs/DECISIONS.md`: JPEG 2000 copier PDFs, evidence linked to the page instead of the exact spot.

## Step 6. Open it to more teachers

Only after the pilot works:

1. Free plan cap and paid plan, Stripe billing (M8). At roughly $0.15 per essay, set the free cap from real step 2 costs.
2. Help pages and a support email with a response-time promise.
3. Load test: 2,000 essays in one evening (M9). WCAG 2.1 AA audit.
4. Status page and on-call alerts for job failures and model errors.
5. College Board license for rubric text and released samples, if you want official wording or a public accuracy page.

## Rough timeline

| Weeks | Work |
| --- | --- |
| 1 | Step 0 decisions, step 1 deploy |
| 2 to 4 | Step 2 benchmark and step 3 privacy, in parallel |
| 5 to 10 | Step 4 pilot, with weekly fixes |
| 11 and on | Step 5 in pilot order, then step 6 |

The biggest risk to this timeline is step 2: if scores do not reach the targets, the pilot waits. Starting the benchmark essays in week 1 protects it.
