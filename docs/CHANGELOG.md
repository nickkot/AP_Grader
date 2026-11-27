# Changelog

## Local model worker (2026-11-27)

**Added**
- `src/lib/llm`: one `complete()` call for every model request. `LLM_PROVIDER` picks Claude or any OpenAI-compatible server (Ollama, a hosted open model); `LLM_FALLBACK_PROVIDER` answers on an error or timeout.
- `llm_jobs` queue for background model work, with atomic claims, leases and a deadline after which the cloud does the job. Reading pages can run on the operator's Mac; scoring stays in the cloud until benchmarked (`LLM_ROUTE_SCORE`).
- Worker API (`/api/llm-worker/claim`, `/api/llm-worker/jobs/:id/:action`), authenticated with `LLM_WORKER_TOKEN`.
- `worker/`: a small Node worker for macOS that polls the site, runs jobs on Ollama and reports back. Outbound connections only. launchd plist and installer, and `caffeinate` to keep the Mac awake.
- `/admin/llm` for `ADMIN_EMAILS`: workers, routes, queue, and cloud spend and estimated savings by month. README has the same numbers as one SQL query.

**Changed**
- Transcription and scoring call `complete()` instead of the Anthropic SDK directly. Prompts, models and outputs are unchanged with the default settings.
- Score run totals now add up every model job of the run, local and cloud.

**Checks:** typecheck, lint, copy lint, unit and integration tests (new: concurrent claims never double-assign, deadline and lease fallbacks, refused late answers, schema-checked answers, the worker round trip for reading and scoring, endpoint tokens, savings by month, the OpenAI-compatible adapter, provider fallback, the worker's settings and job handling), production build, end-to-end flows. A smoke test ran the real worker against the dev server and a stand-in for Ollama.

**Visual QA:** `/admin/llm` at laptop and iPhone 14 widths, light and dark. Fixed: tables scrolled sideways on phones (secondary columns now hide). No serious or critical axe issues.

**Not tested here:** real Ollama models. Run the worker on the Mac and compare a batch of pages before relying on it.

## Student practice, P1 (2026-11-24)

**Added**
- Student accounts. Students join at `/join` with the class code from the class page, then their name (or number in a numbered class). Teachers see the code, how many joined, and a Joined pill per student.
- Practice home with the next essay to write, a note that the teacher can see practice work, and every essay written so far.
- Library of 11 prompts (10 AP Lang argument, 1 APUSH DBQ) with course and status filters.
- Writing room: timed with reading period, countdown and auto-submit, or untimed. Autosave every 5 seconds. Spell check off when timed. Prompt beside the editor on a laptop, tabs on a phone.
- Practice essays scored by the same pipeline as assignments. Results labeled as a practice estimate, with quotes from the student's essay, a next step per row, and a note on rows the model was unsure about.
- Demo student `student@example.com` / `demo-password`, joined to Period 3 with one scored essay.

**Fixed**
- Better Auth's default rate limit (3 sign-ins per 10 seconds per IP) would block a class signing in with Google from one school network.
- Sign-in accepted `next=//other-site`, an open redirect.

**Checks:** typecheck, lint, copy lint, 137 unit and integration tests (new: joining, timing, autosave order, deadlines, the daily cap, privacy of practice essays, name redaction, the sign-in rate limit), production build, end-to-end teacher flow and new end-to-end student flow.

**Visual QA:** practice home, results, library, DBQ prompt, writing room (timed, laptop and phone), submit dialog, join (signed out, code, claim, wrong code), teacher class page with the code. Laptop and iPhone 14, light and dark. Fixed: the writing room's bar squeezed the title on phones, and the student header did not line up with the writing room. No serious or critical axe issues.

**UX simplicity review:** start a timed essay from practice home in 1 tap (budget 2). Results open by themselves when scoring finishes (budget 0). Each screen has one primary button. Submitting asks once, because it cannot be undone.

**Not for real students yet:** practice P2 (moderation, "Ask why" guardrails) must ship first. See `docs/STUDENT_PRACTICE_PLAN.md`.

## Phone upload, numbered rosters, How it works (2026-11-24)

**Added**
- Phone upload by QR code. On a computer, Upload photos shows a Show code card. The phone opens a camera page for that assignment with no sign-in. The link works for 2 hours, only adds pages, and stores only a hash of its token.
- Numbered rosters. A class can list students as Student 1, Student 2 and so on, with no names stored. Packets, screens and the CSV export use the number. A named class can switch to numbers after the teacher downloads the key.
- How it works page in the sidebar: eight steps, rubric flags, typed essays, keyboard shortcuts.
- `docs/LAUNCH_PLAN.md`: steps from this MVP to a teacher pilot.

**Fixed**
- `npm run db:seed` failed on a second run (page photos blocked deleting the demo user).
- Upload batches are now checked against the assignment when a photo is registered and when progress is read.
- "1 page need matching" now reads "1 page needs matching".
- The account button's screen-reader name did not include its visible initials (axe).
- Integration test files reset the same database, so they now run one at a time.

**Checks:** typecheck, lint, copy lint, 122 unit and integration tests (new: phone links, numbered rosters, student names), production build, the end-to-end teacher flow.

**Visual QA:** How it works, upload with the QR dialog, the phone page (ready, after upload, expired link), Create class with numbers, a numbered class, Add students for numbers, Replace names dialog, a class and assignment after the switch. Laptop 1440x900 and iPhone 14, light and dark. Fixed: two primary buttons on the laptop upload screen (Open camera is now secondary there), a repeated sentence on the phone's done message. No serious or critical axe issues.

**UX simplicity review:** photographing a class set is still 1 tap per page after the camera opens; getting the camera onto a phone is 1 click and 1 scan. Each new screen has one primary button. Replacing names is destructive, so it confirms and needs the key download first.

## Learning-product design (2026-11-24)

New design based on patterns from Khan Academy's open-source design system (Wonder Blocks, MIT). It copies the structure only, never the brand: no Khan Academy name, logo, signature colors or characters. Full rationale in `docs/DESIGN.md`. The `design-system` skill is updated to match.

**Changed**
- Lato for UI text (self-hosted), 16 px body text, type scale up to 28 px.
- Off-white canvas with white cards, soft shadows, 12 px card radius, double focus ring.
- Our own deep blue accent, and green, amber and red status colors, each with a soft tint for pills and banners.
- Left sidebar with classes grouped by course and assignments nested, with a slide-out menu on phones.
- Up next card on class and assignment pages, holding the one primary action.
- Assignment page: mastery grid (green earned, light green partly earned, gray not earned, amber ring for review), legend, per-row "earned the point" footer, and a segmented class progress bar.
- Classes page: course sections with class cards and progress bars. Class page: stat tiles and assignment cards.
- Review: each rubric row is a card with an outcome pill and larger points buttons. The total and Approve stay pinned while the score panel scrolls.
- Transcription check: an info banner with the confirm action. Forms, upload, match and sign-in sit in cards.

**Fixed during visual QA**
- The review screen scrolled the whole page to the flagged row, hiding the total and the Approve button. Now only the score panel scrolls.
- Duplicate "Create class" cards in every course section, replaced by one button.
- Secondary actions came before the Up next card on phones. They now come after it.
- Dashed outlines on unscored cells were noisy across a 32-student grid. They now use a quiet solid outline.
- A dark-mode cell color fell under 4.5:1 contrast. Every token pair was checked, and all pass WCAG AA.

**Checks:** typecheck, lint, copy lint, 111 unit and integration tests, the end-to-end teacher flow, and screenshots of 12 routes at laptop and phone widths in light and dark mode. No horizontal page scroll; no serious or critical axe issues.

## MVP: handwritten loop (2026-11-24)

First working version, for APUSH DBQ and AP Lang Argument.

**Added**
- Sign in with Google, plus an email login for local development and tests only.
- Classes with pasted rosters (First Last, Last, First, or CSV).
- Assignment builder: essay type, prompt, numbered documents, time limit, answer pages per student.
- Packet PDF: prompt page with the rubric in student words, documents, QR-coded answer sheets per student, spare sheets, letter or A4, single- or double-sided. Reprints keep the same codes.
- Scanning a sheet's QR code with a phone opens the upload screen for that assignment.
- Upload: in-app camera (one tap per page), photo picker, copier PDF. Photos go straight to storage.
- Page processing: EXIF and QR-based rotation, contrast cleanup, name area blanked before any model sees the page, QR matching, spare sheet and no-QR pages sent to a match screen, retakes replace older photos.
- Transcription with Claude Haiku 5.5 (Sonnet 5.5 retry on hard pages): crossed-out words kept but not scored, illegible words flagged, per-word confidence.
- Check screen: photo beside the transcription, words to check highlighted, edit in place, confirm and score.
- Scoring with Claude Sonnet 5.5: one call per rubric row from a cached prefix, structured output validated with Zod, verbatim quote check, confidence and flags, cost and token logging, cancel.
- Review: class grid with status and flags, essay view with highlighted evidence and page photos, points buttons, comment editing, approve with one key, next essay to review, score again.
- Typed essays: paste or import .docx, .pdf, .txt.
- CSV export (comments only for approved essays).
- Audit log for changes, views and exports.
- Demo seed: 32-student APUSH class with 8 handwritten DBQs in every state, and an AP Lang class with typed essays. All written by us.

**Checks**
- 111 unit and integration tests, including the full pipeline on a packet photographed upside down, and a test that no roster name reaches the scoring model.
- End-to-end Playwright test of the whole teacher flow, from packet download to CSV export.
- CI copy lint for banned UI words and banned feedback phrases.

**Visual QA** (`npm run screenshots`): 12 routes at 1440x900 and iPhone 14, light and dark. Viewed: class grid, review (laptop light, phone dark), transcription check. Fixed: status fill on the unmatched-pages banner, points spacing in the grid, "1 words" copy, keyboard hints on phones, active row scrolled into view, a link that relied on color alone (axe). No horizontal scroll; no serious or critical axe issues after fixes.

**UX simplicity review**
- Print packets for a course: 3 clicks (assignment, Print packets, Download packet).
- Photograph a class set: 1 tap per page, 1 to finish.
- Open the next essay that needs review: 1 click from the assignment page, or N.
- Approve with no changes: 1 key (A), which also moves to the next essay.
- One primary button per screen, chosen by what the teacher should do next.

**Known gaps:** see "Known limits" in `docs/DECISIONS.md`.
