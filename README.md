# Essay Grader (working name)

Scores handwritten AP essays point by point against the rubric, with the teacher approving every score.

This branch is the **MVP**: the handwritten loop for APUSH DBQ and AP Lang Argument.

1. Create a class and paste the roster, or list students by number so no names are stored.
2. Create an assignment (prompt, numbered documents, time limit).
3. Print one packet: prompt page, documents, and QR-coded answer sheets for every student plus spares.
4. Photograph the pages on a phone (scan the code on the Upload photos screen, then one tap per page) or upload a copier PDF.
5. Pages are matched to students by QR code, cleaned up, and the printed name is blanked out before transcription.
6. Check the transcription beside the photo, then score. Each rubric row is scored separately, with quotes that are verified against the essay.
7. Review, adjust, approve (one key), export CSV.

Typed essays (paste, .docx, .pdf, .txt) work too.

Design: `docs/DESIGN.md`. Plans: `docs/LAUNCH_PLAN.md` (MVP to teacher pilot), `docs/PLAN.md` (full product), `docs/STUDENT_PRACTICE_PLAN.md` (student side, awaiting approval). Decisions: `docs/DECISIONS.md`. Deployment: `docs/DEPLOY.md`.

## Run it locally

Needs Node 22 and Postgres 16.

```bash
cp .env.example .env            # then set BETTER_AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed                 # demo teacher: demo@example.com / demo-password, demo student: student@example.com / demo-password
npm run dev
```

Open http://localhost:3000. With `MODEL_MODE=fake` (the default in `.env.example`) transcriptions and scores are canned, so no API key is needed. Set `MODEL_MODE=anthropic` and `ANTHROPIC_API_KEY` to use Claude.

## Checks

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run lint:copy` | Banned UI words (product-voice) and banned feedback phrases (student-feedback-writing) |
| `npm test` | Unit and integration tests (Vitest, needs the test database `ap_grader_test`) |
| `npm run test:e2e` | The full teacher flow in Chromium (Playwright) |
| `npm run screenshots` | Visual QA screenshots and axe checks at laptop and phone widths, light and dark |

CI runs all of these on every pull request (`.github/workflows/ci.yml`).

## Layout

```
src/app/                 Screens and API routes (Next.js App Router)
src/components/ui/       shadcn/ui components (written in by hand, same source)
src/lib/ai/              Transcription, scoring, redaction, quote checks
src/lib/pipeline/        Image cleanup and QR reading, background job steps
src/lib/packet/          Packet PDF and QR tokens
src/lib/rubrics/         Rubric definitions (our own paraphrased rules, versioned)
src/lib/actions/         Server actions
src/lib/db/              Drizzle schema
src/lib/demo/            Demo essays, documents and handwritten page photos (written by us)
scripts/                 Migrate, seed, screenshots, copy lint, demo page generator
tests/                   unit, integration, e2e
.claude/skills/          Project skills: design system, voice, feedback writing, reviews
```
