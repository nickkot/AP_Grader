# Claude Code Build Prompt: AP Essay Grader

Unzip the starter kit into an empty folder (it adds `.claude/skills/`), open Claude Code there, and paste everything below.

---

## Role and how to work

You are the lead engineer building a production web app: an AI essay grader for AP humanities teachers. It scores free-response work point by point against AP rubrics, starting with AP U.S. History, AP English Language and AP English Literature, then AP U.S. Government and Politics. Teachers approve every score. Schools and districts buy it.

Work this way:

1. Before writing code, read this whole prompt. Then produce `docs/PLAN.md` with your architecture, data model, milestone breakdown and open questions. Stop and show me the plan before building.
2. Build in the milestones below, in order. Each milestone ends with passing tests, a seeded demo and a short `docs/CHANGELOG.md` entry.
3. Keep the code boring and well typed. Prefer managed services over custom infrastructure.
4. Never hardcode secrets. Use `.env.example` and document every variable.
5. When a requirement is ambiguous, pick the simplest reasonable option, note it in `docs/DECISIONS.md` and keep going.

## Skills (required)

This repo ships with skills in `.claude/skills/`. Use them every time they apply; they exist to keep the product simple and keep it from looking or sounding AI-generated.

| Skill | Use it when |
| --- | --- |
| `frontend-design` (Anthropic's official skill, install it) | Starting any new screen or reworking a layout |
| `design-system` | Building or changing any UI component, style or screen |
| `product-voice` | Writing any words a user sees: labels, buttons, errors, emails, help text |
| `student-feedback-writing` | Writing or changing scoring prompts, feedback templates or default comments |
| `ux-simplicity-review` | Before finishing any screen or flow |
| `visual-qa` | Before calling any UI work done |

Rules:
- `design-system` overrides `frontend-design` wherever they disagree.
- No UI task is done until `ux-simplicity-review` and `visual-qa` have both been run on it.
- No scoring or feedback prompt ships until the tests in `student-feedback-writing` pass.
- Add a CI lint step that fails on banned words from `product-voice` in UI copy and on banned feedback phrases in prompt templates.

## Product summary

**Users and roles**
- **Teacher:** creates classes and assignments, imports essays, reviews AI scores, returns feedback.
- **Student:** submits essays (optional) and sees approved feedback.
- **Department lead or AP coordinator:** sees analytics across teachers and sections.
- **District admin:** manages schools, licenses, SSO, data agreements and usage.
- **Internal admin:** manages rubrics, benchmarks, customers and support.

**Core promise:** score a class set of DBQs or Lang essays in minutes, at AP-reader accuracy, with the teacher in control and student data protected.

## Recommended stack

Adjust only if you have a strong reason, and record it in `docs/DECISIONS.md`.

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Postgres with Prisma (or Drizzle), row-level tenant isolation
- Background job queue (e.g. Inngest, Trigger.dev or BullMQ + Redis) for batch grading
- Object storage (S3-compatible) for uploads and scans, encrypted at rest
- Anthropic API (Claude) for scoring, using structured JSON outputs and tool use
- OCR for handwriting (a vision-capable model first; a dedicated OCR provider as fallback)
- Auth: Google, Microsoft, Clever and ClassLink SSO, plus email magic links
- Stripe for self-serve billing; invoice and PO flow for schools
- Vitest and Playwright for tests; Sentry and structured logs for observability

## Features

### 1. Rubric engine

- Model each AP essay type as a structured rubric: rows, point values, and the decision rules for each point.
  - APUSH: DBQ (7 points), LEQ (6 points), SAQ (3 parts).
  - AP Lang: Synthesis, Rhetorical Analysis, Argument (6 points each: thesis 0-1, evidence and commentary 0-4, sophistication 0-1).
  - AP Lit: Poetry Analysis, Prose Analysis, Literary Argument (same 6-point structure).
  - AP U.S. Government and Politics: Concept Application, Quantitative Analysis, SCOTUS Comparison, Argument Essay.- Design the schema so World History, European History, AP Gov, Psych, IB and custom teacher rubrics can be added without code changes.
- Rubrics are versioned. Every score records the rubric version used.
- Teachers can clone a rubric and adjust wording or add class-specific criteria.
- **Licensing guardrail:** College Board rubrics, scoring guidelines and released essays are copyrighted. Do not ship their verbatim text in the repo or seed data. Store rubric structure plus our own paraphrased decision rules, and leave a clear slot for licensed content. Add a `docs/LEGAL_TODO.md` listing what needs permission, including use of the "AP" trademark.

### 2. Essay ingestion

- Paste text, upload .docx, .pdf, .txt, or import a Google Drive folder.
- Google Classroom, Canvas and Schoology integrations: roster sync, pull submissions, push grades and comments back.
- CSV import for AP Classroom exports.
- Handwritten essays from photos are a primary input, not an add-on (see section 2b).
- Attach the prompt and, for DBQs, the documents, so scoring has context.
- De-duplicate and match essays to students automatically, with a manual fix-up screen.

### 2b. Handwritten in-class essays (core anti-cheating workflow)

The main way to stop AI cheating is for students to write by hand, in class, under supervision. Teachers then photograph the essays and the platform does the rest. Make this the default, fastest path in the product.

- **Printable assignment packet:** one click generates a print-ready PDF per class with:
  - a prompt page (the question, time limit, instructions and the rubric rows in student-friendly words),
  - the DBQ documents or Lang synthesis sources, numbered as the prompt refers to them,
  - lined answer sheets, one set per student, each page carrying a QR code that encodes the assignment, student and page number ("page 2 of 4"), plus the student's printed name for a human check.
- Packet options: print in roster order or alphabetically, number of answer pages per student, spare blank QR sheets for absent or new students (the student writes their name and the teacher matches it on upload), single- or double-sided, letter or A4.
- The QR code is the link between paper and platform: scanning a page with any phone camera opens the upload flow for that exact assignment, so a teacher can photograph pages without navigating the app first.
- QR codes contain only opaque IDs, never student names or school data, so a lost page reveals nothing.
- **Capture:** teachers photograph pages on a phone (mobile web first, with a camera mode that auto-detects page edges and fires automatically) or scan a whole stack on a school copier and upload one PDF.
- **Auto-sorting:** read QR codes to assign each page to the right student and assignment and order the pages. Fall back to name recognition from the page header, then a quick manual matching screen.
- **Image cleanup:** de-skew, crop, flatten curved pages, fix lighting and contrast before transcription.
- **Transcription:** handwriting OCR with a vision-capable model. Keep crossed-out text marked as deleted, not scored. Flag illegible words instead of guessing.
- **Verification:** show the original photo and the transcription side by side, with low-confidence words highlighted for fast teacher correction. Scoring waits until the teacher confirms, or the teacher opts to auto-confirm above a confidence threshold.
- **Fair scoring:** never penalize spelling or grammar caused by transcription errors; scores reference the photo, and evidence quotes link back to the exact spot on the page image.
- **Record of authenticity:** store the original page images with capture time, uploader and assignment, so the class has a verifiable record that the work was handwritten in class. Students see their own scanned pages alongside feedback.
- **Timed-write mode:** the teacher starts a timed session in the app (prompt display, countdown for the projector), which stamps the assignment as completed in class.
- **Scale:** handle a 150-student, 600-page batch in one upload, processed in the background with progress and per-page error recovery.
- **Accuracy harness:** add handwriting transcription accuracy (word error rate on a handwritten benchmark set) to the CI benchmark, alongside scoring accuracy.

Be clear in the product that handwriting only prevents cheating when the writing happens under supervision. An essay copied by hand from an AI draft at home is still copied, so the timed in-class workflow is the recommended path.

### 3. Scoring pipeline

- Score each rubric row independently, then combine. For every row, return:
  - the points awarded,
  - a short justification in teacher-facing language,
  - quoted evidence from the essay that supports the decision,
  - a confidence score.
- Flag low-confidence rows and borderline totals (for example, essays one point from a band edge) for priority teacher review.
- Use structured outputs validated with Zod. Retry or route to review on any schema failure.
- Run as background jobs with per-class progress, cancellation and partial results.
- Make the model, prompt version and rubric version part of every score record so results are reproducible.
- Keep costs visible: log tokens and cost per essay and per class.
- Strip student names and identifiers before sending text to the model. Never send demographic data.

### 4. Teacher calibration

- Teachers can upload essays they already scored. Use them as few-shot anchors and to measure the teacher's agreement with the AI.
- Show each teacher a calibration report: agreement by rubric row, and where the AI runs harsher or more lenient than they do.
- Apply each teacher's anchors only to their own classes. Department-level shared anchors are optional and opt-in.

### 5. Teacher review experience

- Class grid: students down, rubric rows across, color-coded by confidence and review status.
- Essay view: essay text (or scan) on one side, row-by-row scores with highlighted evidence on the other.
- One-click accept, adjust a row, or edit the comment. Keyboard shortcuts for fast review.
- Nothing reaches students until the teacher approves it. Bulk approve only for rows the teacher has marked trusted.
- Track every override; feed overrides into calibration and into our internal accuracy metrics.

### 6. Student feedback

- Per-row feedback that names the point earned or missed and one concrete next step.
- Feedback style options (rubric-row, glow and grow, two stars and a wish).
- Revision mode: students resubmit and see progress on the same rows.
- Student view is read-only, plain language, and works well on phones.

### 7. Department and district analytics

- Rubric-row mastery by teacher, section and school (for example, "contextualization earned in 41% of DBQs").
- Trends across the year and projected AP score bands, clearly labeled as estimates.
- Usage: essays scored, teacher time saved, active teachers.
- Export to CSV and PDF.

### 8. Accuracy and fairness harness (internal, run in CI)

- A benchmark set of human-scored essays per essay type, stored separately from customer data.
- Metrics per essay type and per rubric row: exact agreement, within-one-point agreement, quadratic weighted kappa, and mean bias (AI minus human), especially at band edges.
- Fairness checks: compare score bias across subgroups where the benchmark data allows, and test that adding identity cues to the essay does not change scores or feedback.
- Fail CI if a prompt or model change lowers agreement past a set threshold.
- Generate a public-facing accuracy page from the latest run.

### 9. Privacy, security and compliance

- FERPA and COPPA aligned data handling; support state student-privacy laws.
- Tenant isolation by district and school; role-based access control.
- Contractual and technical guarantee: no training on student data. Use model API settings that prevent provider retention where available.
- Encryption in transit and at rest; signed short-lived URLs for files.
- Data retention controls, district-requested export and deletion, and deletion confirmations.
- Audit log of who viewed or changed what.
- SOC 2 readiness: access reviews, change management, incident response doc. Put policy templates in `docs/security/`.
- A data privacy agreement (DPA) workflow: districts upload their DPA, admins track signed status.

### 10. Account management, licensing and billing

**10a. Organization hierarchy**
- District → school → department → class, plus "independent teacher" accounts with no organization.
- A teacher can belong to more than one school (common for shared or itinerant staff).
- A teacher who signed up on their own can later join their school's license without losing classes, scores or calibration data.
- Schools can exist without a district, and later be attached to one.

**10b. User accounts**
- Sign up and sign in with Google, Microsoft, Clever, ClassLink or email magic link.
- Optional password plus multi-factor authentication (authenticator app). District admins can require MFA for staff.
- Profile: name, display name, school email, subjects taught, grade levels, time zone, avatar.
- Change email with verification of both old and new address; change sign-in method; link multiple sign-in methods to one account.
- Active sessions and devices list, with "sign out everywhere."
- Self-serve data export (all classes, essays, scores, feedback) and account deletion with a grace period and confirmation.
- Detect and merge duplicate accounts (same person, different emails or sign-in methods) with an admin-approved merge flow.

**10c. Student accounts**
- Students join by class code, QR code, Clever or ClassLink badge, or roster sync. No email required.
- Under-13 handling: school-provided consent under COPPA, no direct marketing, minimal data collection.
- Students cannot see other students, change their own roster placement or see unapproved scores.
- Teachers can reset a student's access, move students between sections, and remove students.
- Students who leave or graduate are archived on the district's retention schedule.

**10d. Invitations, provisioning and domains**
- Invite users by email, CSV upload or shareable invite link, with role and school preset. Expiring, revocable invites; resend and reminder emails.
- Domain verification (DNS or admin email) so anyone with a verified district domain can auto-join or request to join.
- Join-request queue for school and district admins to approve or deny.
- Automated provisioning and deprovisioning via SCIM, OneRoster, Clever and ClassLink. Deprovisioned staff lose access immediately; their classes transfer, not disappear.

**10e. Roles and permissions**
- Built-in roles: student, teacher, co-teacher, department lead, AP coordinator, school admin, district admin, billing admin, read-only viewer.
- Permission checks enforced server-side on every request, with tests for each role.
- Co-teaching: share a class with edit or view rights.
- Department and school admins can see analytics but not edit a teacher's scores unless granted.

**10f. Class and staff lifecycle**
- Transfer class ownership when a teacher leaves, goes on leave or changes schools.
- Substitute or temporary access with an expiry date.
- End-of-year rollover: archive last year's classes, carry over rubrics and calibration anchors, create new sections from the new roster.
- Restore archived classes; soft-delete everything with a recovery window before hard delete.

**10g. Admin console (school and district)**
- User directory with search and filters; deactivate, reactivate, change role, reset sign-in, resend invite.
- Seat management: assigned vs. available seats, reassign seats, waitlist when seats run out.
- Settings: allowed sign-in methods, MFA requirement, session timeout, data retention period, which integrations are enabled, whether students can see AI-drafted feedback before teacher approval (default off).
- Usage dashboard: active teachers, essays scored, time saved, by school.
- Audit log viewer with export.

**10h. Licensing**
- Plans: free teacher (monthly essay cap), paid teacher (monthly or annual), department license (flat annual), district license (per AP student, with minimums).
- Trials with automatic downgrade, not deletion, when they end.
- Entitlements service: one place that decides what each account can do, so plan changes never require code changes elsewhere.
- Usage limits and quotas with soft warnings at 80% and clear upgrade paths at 100%.
- License terms aligned to the school year (for example, July 1 to June 30), with renewal reminders at 90, 60 and 30 days.

**10i. Billing**
- Stripe for card and ACH; invoices and purchase orders for schools.
- Self-serve quote builder (seats, plan, term) producing a downloadable PDF quote valid 30 days, with a quote ID the business office can reference on the PO.
- Upload a PO; account activates when the PO is received, while payment terms (net 30 or net 60) run.
- Billing contacts separate from users; multiple billing contacts per organization.
- Tax-exempt certificate upload, W-9 download, vendor forms and sole-source letter templates.
- Invoices, receipts and payment history; update payment method; change plan with proration; cancel with an exit survey.
- Failed payment handling (dunning): retries, emails and a grace period before downgrade.
- Credits and refunds handled by internal admins, with an audit trail.

**10j. Notifications and communication**
- Email and in-app notifications: grading batch finished, essays need review, invite accepted, seats running low, license renewal, payment failed.
- Per-user notification preferences and a digest option; legally required emails cannot be turned off.
- Product announcements and release notes in-app.

**10k. Support**
- In-app help center, contact support form with account context attached, and a public status page link.
- Internal admins can impersonate a user only with a logged reason, and the user's organization can see that it happened.

### 11. Integrations and SSO

- Google Classroom, Canvas (LTI 1.3), Schoology.
- SSO via Google, Microsoft, Clever and ClassLink.
- Webhooks or polling to keep rosters current.

### 12. Academic integrity (optional, behind a flag)

- Do not build an AI-writing detector. Handwritten in-class essays (section 2b) are the primary integrity safeguard. For typed work, offer an optional in-app writing space that records drafting history, so teachers can review process rather than rely on detection scores.

### 13. Internal admin and support

- Customer and license management, impersonation with audit logging, rubric publishing, benchmark runs and cost dashboards.

### 14. Course catalog and class grouping

- A course catalog that every class belongs to. Launch courses: AP U.S. History, AP English Language, AP English Literature, AP U.S. Government and Politics. Store courses as data so AP World, AP Euro, AP Psych, IB and non-AP courses can be added without code changes. AP Economics is out of scope for now; do not build graph-image scoring.
- When a teacher creates a class, they pick the course and period or section name. Roster sync suggests the course from the course name in Google Classroom, Canvas, Schoology or OneRoster, and the teacher confirms.
- Each course carries its own essay and FRQ types, default rubrics, scoring prompts, benchmark sets and terminology, so a teacher only sees options that fit that course.
- **Teacher dashboard:** classes grouped by course (for example, "AP Lang: Periods 2, 4, 6"), with a combined view across all sections of one course and the option to create one assignment for every section at once.
- **Department and school views:** filter and compare by course, teacher and section (for example, "AP Gov argument essays across all four teachers").
- **District views:** roll up by course across schools, with course-level usage, rubric-row mastery and projected score bands.
- Licensing can be scoped by course (for example, a district buys AP History and AP English only), enforced through the entitlements service.
- Calibration anchors, rubric customizations and benchmark accuracy are all tracked per course, and accuracy is published per course and per FRQ type.

### 15. Gradebook and school system (SIS) sync

Districts report grades from their student information system (SIS), not from our app. Getting approved scores into that system cleanly is a major buying factor, so treat it as a core feature.

**Score-to-grade conversion**
- Convert AP rubric scores into class grades (for example, a 6-point Lang essay or a 7-point DBQ into a percentage or letter grade).
- Conversion tables are configurable at the district, school, department and teacher level, with the most specific one winning. Ship sensible defaults per course and essay type, plus a linear option and a custom point-by-point table (for example, 6 = 100, 5 = 93, 4 = 85).
- Option to grade on the AP score alone, on a teacher's adjusted score, or on a combined rubric plus class-specific criteria.
- Standards-based grading option: map rubric rows to the district's standards and report a proficiency level per standard instead of one percentage.
- Rounding rules, extra credit, late penalties, excused and missing marks, and drop-lowest rules.

**Gradebook**
- A gradebook per class with assignment categories and weights (for example, timed writes 40%, practice 20%), grading periods and terms that match the school calendar.
- Running grade per student per course, with a clear breakdown of how it was calculated.
- Grade history and audit trail: every change records who, when, old value, new value and reason.
- Only teacher-approved scores ever reach the gradebook.

**Sync to school systems**
- Integrations with PowerSchool, Infinite Campus and Skyward, plus OneRoster 1.2 gradebook services as the common standard so other systems (Aeries, Synergy, Blackbaud and others) can follow.
- Map our classes, sections, assignments, categories and grading periods to the matching SIS records, with a setup screen for the teacher or district admin and automatic matching where IDs line up.
- Sync modes: teacher clicks "post grades," or automatic sync on approval. District admins choose which modes are allowed.
- Detect conflicts (a grade changed in the SIS after we posted it) and show them for the teacher to resolve; never silently overwrite a grade changed in the SIS.
- Retry with clear error messages when a sync fails (closed grading period, missing section, locked gradebook), and a sync log per class.
- CSV export formatted for each SIS as a fallback when an integration is not available or not approved.
- Grades posted to the SIS flow on to parent and student portals there, so keep comment text short and parent-appropriate when it syncs.

**Partnerships and approvals**
- PowerSchool, Infinite Campus and Skyward each require a partner program, certification or district-level approval before writing grades. Add this to `docs/LEGAL_TODO.md` with the steps for each, and build against their sandbox or test environments first.

### 16. Assignment builder and prompt library

- Create an assignment in a few steps: pick the course and essay type, write or choose a prompt, attach sources, pick the rubric, set the time limit, due date and sections.
- DBQ and synthesis source sets: upload documents as images or PDFs, crop and number them, add citations, and reorder them. Sources print in the packet and are available to the scoring pipeline as context.
- Prompt library with three layers: the teacher's own prompts, a shared department and district library, and a starter library of original practice prompts we write (no College Board text without a license; see `docs/LEGAL_TODO.md`).
- Duplicate any assignment, including last year's, and assign it to multiple sections or courses at once.
- Tag prompts by course, essay type, unit, historical period or skill so teachers can search and filter.
- Assignment types: timed in-class write, take-home draft, revision of an earlier essay, and practice (scored but not sent to the gradebook).
- Draft, scheduled, open, closed and archived states; edits to an assignment after scoring starts are versioned so scores stay tied to the version students saw.
- Preview the assignment exactly as students and the printed packet will show it.

### 17. Inline annotation and comment bank

- Teachers annotate directly on the essay, either on the page photo (highlight, underline, circle, freehand pen, sticky note) or on the transcription (highlight a passage and comment).
- Annotations on the photo and the transcription stay linked, so a comment on one shows in the right place on the other.
- AI evidence quotes appear as suggested highlights the teacher can accept, edit or delete.
- Comment bank: teachers save reusable comments, tag them to rubric rows, and insert them with a click or shortcut. Comments can be shared with the department, and each course starts with a default set the teacher can edit.
- Track which comments get used most, and suggest the right banked comment when the AI flags a missed rubric point.
- Students see annotations on their own page images and transcription, with each comment linked to the rubric row it relates to.
- Annotation works well with a stylus on tablets and with touch on phones.

### 18. Onboarding

- Setup wizard for new teachers: connect Google Classroom or another LMS, pick courses, import rosters, and choose a default grade conversion. It should take under 5 minutes.
- Sample class preloaded with demo students and demo handwritten essays (written by us, not real students), so a teacher can try the full workflow before using real student work.
- "First batch" walkthrough: guided steps through printing a packet, photographing pages, confirming transcriptions, reviewing scores and posting grades, with a progress checklist.
- Short in-app training videos (1-3 minutes each) for each main task, plus a searchable help center.
- Admin onboarding for schools and districts: verify domain, set up SSO and rostering, invite teachers in bulk, sign the data privacy agreement, and assign licenses.
- Track onboarding completion and send helpful nudges to teachers who stall (for example, printed a packet but never uploaded pages).

### 19. Student portfolios

- Each student has a portfolio that follows them across assignments, classes, courses and school years within the district.
- Shows every essay with its page images, scores, feedback and revisions, plus growth by rubric row over time (for example, thesis and contextualization across APUSH and AP Lang).
- Teachers can see a new student's history when they inherit them in a new course, subject to district permission settings.
- Students can pick their best work to feature and add reflections.
- Export a student's portfolio as a PDF; students keep access to exports after graduating if the district allows.
- Portfolios follow district retention rules and are deleted or archived on schedule.

### 20. Parent reports, translated feedback and native mobile app

**Parent reports**
- Optional, off by default, and controlled by the district.
- Periodic reports (by email or a parent link) showing assignments completed, rubric-row progress and teacher comments in plain language. No AI-drafted text reaches parents without teacher approval.
- Parent access by secure invite or through district-approved SSO; parents only see their own children.

**Translated feedback**
- Students and parents can view approved feedback in their preferred language, starting with Spanish, Chinese, Vietnamese, Arabic and Tagalog.
- Translations are machine-generated, clearly labeled, and shown next to the original English feedback.
- Rubric terms use a reviewed glossary per language so key terms translate consistently.

**Native mobile app**
- iOS and Android apps for teachers, focused on capture and review: batch camera with auto edge detection and auto capture, QR page sorting, offline capture that uploads when back online, and fast score review.
- Push notifications for finished grading batches and essays needing review.
- Students can view feedback and their scanned pages in the app.
- Build the mobile web capture flow first; the native apps reuse the same APIs.

## Milestones

1. **Foundation:** repo, auth, organization hierarchy, user accounts, roles and permissions, invitations, database schema, CI, seeded demo data.
2. **Rubric engine + scoring MVP:** APUSH DBQ and AP Lang Argument only; basic assignment builder (prompt, sources, rubric, time limit) and printable packets; handwritten photo upload with QR answer sheets, auto-sorting, transcription and verification; paste and file upload as secondary inputs; scoring pipeline; teacher review screen.
3. **Accuracy harness:** benchmark runner, metrics, CI gate. Do not expand scope until this exists.
4. **All core essay types and course grouping:** remaining APUSH, Lang and Lit types; course catalog and class grouping by course; calibration with teacher anchors.
4b. **AP Gov:** all Gov FRQ types, gated by their own benchmark results.
5. **Classroom workflow and gradebook:** Google Classroom integration, grade passback, score-to-grade conversion, class gradebook with categories and weights, inline annotation and comment bank, full prompt library, student feedback view, revision mode, teacher onboarding (setup wizard, sample class, first-batch walkthrough).
6. **Handwriting at scale:** auto-capture camera mode, copier PDF batches of 600+ pages, image cleanup polish, timed-write mode, auto-confirm thresholds.
7. **Schools:** department and district analytics, Canvas and Schoology, Clever and ClassLink SSO, SIS grade sync (OneRoster first, then PowerSchool, Infinite Campus and Skyward), district-level grading policies, student portfolios, admin onboarding.
8. **Commercial and admin:** licensing and entitlements, billing, quotes and POs, admin console, SCIM and OneRoster provisioning, class and staff lifecycle (transfers, year-end rollover), notifications, DPA workflow, audit logs, security docs.
9. **Hardening:** load test batch grading (a 2,000-essay district run), accessibility (WCAG 2.1 AA), error budgets and alerting, training videos and help center.
10. **Families and mobile:** parent reports, translated feedback, native iOS and Android teacher apps.

## Definition of done for the MVP (milestones 1-3)

- A teacher can sign in with Google, create a class, print QR answer sheets, photograph 30 handwritten DBQs on a phone, confirm transcriptions, and get row-by-row scores with evidence linked to the page images in under 10 minutes.
- The teacher can review, adjust and approve scores, and export them.
- The benchmark harness reports agreement metrics for both MVP essay types, and CI fails on a regression.
- No student names reach the model, and every score is reproducible from its stored versions.

## First response I expect from you

1. `docs/PLAN.md` with architecture diagram (Mermaid), data model, milestone tasks and estimates.
2. A list of open questions, especially on rubric licensing and benchmark data sources.
3. Nothing else until I approve the plan.
