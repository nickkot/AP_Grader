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

Open http://localhost:3000. With `MODEL_MODE=fake` (the default in `.env.example`) transcriptions and scores are canned, so no API key is needed. Set `MODEL_MODE=anthropic` and `ANTHROPIC_API_KEY` to use Claude. To run background jobs on your own Mac with Ollama, see [Local inference with Ollama](#local-inference-with-ollama).

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

## Local inference with Ollama

Background model jobs can run on your own Mac with [Ollama](https://ollama.com) instead of the Claude API, to cut API costs. The site stays reliable when the Mac is off or asleep: any job the Mac cannot take or finish runs in the cloud.

### How it works

```
  Site (Railway, Vercel...)                         Your Mac
  ---------------------------------                 ---------------------------------
  page uploaded / essay sent to scoring
    -> worker online with the model? --no--> cloud now
    -> yes: row in llm_jobs (pending)
                          <-- HTTPS POST /api/llm-worker/claim --  worker (worker/llm-worker.ts)
    claim: FOR UPDATE SKIP LOCKED,                                      | prompt, image, JSON Schema
    lease + fresh claim token          -- job ------------------->     v
                                                                      Ollama on 127.0.0.1:11434
                          <-- POST /jobs/:id/complete (answer) --
    check the answer, save it, record tokens and the cloud cost avoided
  deadline or lease passed? -> cloud fallback runs the job
```

| Job | Where it runs | Why |
| --- | --- | --- |
| Reading a page (`transcribe_page`) | Your Mac when a worker with `LLM_LOCAL_MODEL_TRANSCRIBE` is online, else the cloud | Background work. Needs a vision model |
| Scoring an assignment essay, one job per rubric row (`score_row`) | The cloud by default. Set `LLM_ROUTE_SCORE=local` only after the local model passes the accuracy benchmark | Scores reach students, so quality comes first |
| Re-reading a hard page, student practice scoring | Always the cloud, through `src/lib/llm` | Students wait on practice results; re-reads exist because the first reading was weak |

Every model call in the app goes through `complete()` in `src/lib/llm`. It reads `LLM_PROVIDER` (Claude or any OpenAI-compatible server) and falls back to `LLM_FALLBACK_PROVIDER` on an error or timeout.

### Safety

- **Outbound only.** The worker connects out to the site over HTTPS. It opens no ports and Ollama stays on `127.0.0.1`. Never set `OLLAMA_HOST=0.0.0.0`.
- **No database credentials on the Mac.** The worker holds one secret, `LLM_WORKER_TOKEN`, and can only claim and answer jobs. Database credentials and the Anthropic key stay on the server. Rotating the token on the server cuts the worker off.
- **Least data.** The Mac receives the page photo with the printed name blanked, or the essay with student names redacted, plus the rubric. Job rows hold ids, never essays. The worker writes nothing to disk and logs only job ids, counts and timings. Do not set `OLLAMA_DEBUG`, which logs prompts. Turn on FileVault.
- **Answers are checked.** An answer that does not match the JSON Schema is never saved; the cloud does that job. Quotes are verified and banned feedback wording gets one retry, the same as cloud answers.

### Setup, end to end

**1. Server.** Run `npm run db:migrate` (adds `llm_jobs` and `llm_worker`). Then set these and redeploy:

```bash
LLM_WORKER_TOKEN=<openssl rand -hex 32>
ADMIN_EMAILS=you@yourdomain.com
# Optional, these are the defaults:
LLM_ROUTE_TRANSCRIBE=local
LLM_ROUTE_SCORE=cloud
LLM_LOCAL_MODEL_TRANSCRIBE=qwen2.5vl:32b
LLM_LOCAL_MODEL_SCORE=qwen3:32b
```

All the settings, with what each does, are in `.env.example` under "Model provider and local worker".

**2. Ollama on the Mac.** Install it (`brew install ollama` or the app from ollama.com), start it, and pull the models named in the server settings:

```bash
ollama pull qwen2.5vl:32b
ollama pull qwen3:32b
ollama list
```

Each 32B model takes about 20 GB of memory. To use a different model, pull it and set the matching `LLM_LOCAL_MODEL_*` on the server; the worker offers whatever `ollama list` shows.

**3. The worker.** On the Mac, in a checkout of this repository with Node 22:

```bash
npm ci
cp worker/.env.example worker/.env
chmod 600 worker/.env
```

In `worker/.env`, set `AP_GRADER_URL` to the site's `https://` address and `LLM_WORKER_TOKEN` to the server's value. Then try it in the foreground:

```bash
bash worker/run.sh
```

It logs `worker started`, and `/admin/llm` on the site shows the worker as Online with its models. Upload a page and the log shows `job completed`. Press Ctrl+C to stop; a job in progress goes back to the queue.

**4. Start at login.** Install it as a launchd login item that restarts if it stops:

```bash
bash worker/install-launchd.sh
```

Logs go to `~/Library/Logs/apgrader-llm-worker.log`. To remove it: `bash worker/install-launchd.sh uninstall`. The plist (`worker/com.apgrader.llm-worker.plist`) holds no secrets.

**5. Keep the Mac awake.** `worker/run.sh` runs the worker under `caffeinate -is`, which stops idle sleep, and system sleep while on power, for as long as the worker runs. On top of that:

- Keep the Mac on its charger. On battery, macOS can still sleep.
- Closing the lid sleeps a MacBook unless it is on power with an external display (clamshell mode).
- In System Settings, Battery, Options, turn on "Prevent automatic sleeping on power adapter when the display is off".
- To check what is holding the Mac awake: `pmset -g assertions`.

If the Mac sleeps anyway, nothing gets stuck: its jobs run in the cloud.

### What happens when the Mac is not there

| Situation | What the site does |
| --- | --- |
| Worker off, asleep or without the model (no check-in for `LLM_WORKER_STALE_SECONDS`, 90 by default) | New jobs run in the cloud right away |
| `LLM_LOCAL_MAX_QUEUE` jobs (5) already waiting for the Mac | New jobs run in the cloud right away |
| Nobody claims a job by its deadline (`LLM_LOCAL_TIMEOUT_SECONDS`, 10 minutes) | The cloud runs it |
| The Mac sleeps holding a job (no lease extension for `LLM_LEASE_SECONDS`) | The cloud runs it; the Mac's late answer is refused |
| Ollama fails, or the answer does not match the schema | The cloud runs it at once |
| Two workers ask at the same moment | Each job goes to exactly one of them (`FOR UPDATE SKIP LOCKED` plus a per-claim token) |

The worker extends its lease about once a minute while a job runs, which also counts as its check-in. A laptop takes far longer per job than the API, so raise `LLM_LOCAL_MAX_QUEUE` only after timing your Mac: roughly `LLM_LOCAL_TIMEOUT_SECONDS` divided by its seconds per job.

### Savings

Every job is a row in `llm_jobs` with its tokens. A local job also stores what the same tokens would have cost on the cloud model at list price (`cloud_cost_estimate_usd`); a cloud job stores what it cost (`cost_usd`). `/admin/llm` shows workers, routes, the queue and a month-by-month table, for the emails in `ADMIN_EMAILS`. The same numbers in SQL:

```sql
select to_char(date_trunc('month', completed_at at time zone 'UTC'), 'YYYY-MM') as month,
       count(*) filter (where provider = 'local') as local_jobs,
       count(*) filter (where provider = 'cloud') as cloud_jobs,
       coalesce(sum(tokens_in + tokens_out) filter (where provider = 'local'), 0) as local_tokens,
       round(coalesce(sum(cost_usd) filter (where provider = 'cloud'), 0), 2) as cloud_spend_usd,
       round(coalesce(sum(cloud_cost_estimate_usd) filter (where provider = 'local'), 0), 2) as saved_usd
from llm_jobs
where status = 'completed'
group by 1
order by 1 desc;
```

Saved is an estimate: it ignores prompt caching discounts the cloud would have applied, and electricity.

### Troubleshooting

| Log line or symptom | Fix |
| --- | --- |
| `The site refused the worker token` | `LLM_WORKER_TOKEN` differs between `worker/.env` and the server |
| `Ollama is not answering or has no models` | Start Ollama; check `curl http://127.0.0.1:11434/v1/models` |
| Worker Online but jobs still go to the cloud | The model names on the admin page must match `LLM_LOCAL_MODEL_*` exactly; check the route settings |
| Many `job failed` lines | Usually memory. Use a smaller model or keep `WORKER_CONCURRENCY=1` |

## Layout

```
src/app/                 Screens and API routes (Next.js App Router)
src/components/ui/       shadcn/ui components (written in by hand, same source)
src/lib/ai/              Transcription, scoring, redaction, quote checks
src/lib/llm/             The one model call: Claude or any OpenAI-compatible server, with fallback
src/lib/llm-queue/       llm_jobs queue: routing, atomic claims, cloud fallback, worker API, savings
src/lib/pipeline/        Image cleanup and QR reading, background job steps
src/lib/packet/          Packet PDF and QR tokens
src/lib/rubrics/         Rubric definitions (our own paraphrased rules, versioned)
src/lib/actions/         Server actions
src/lib/db/              Drizzle schema
src/lib/demo/            Demo essays, documents and handwritten page photos (written by us)
scripts/                 Migrate, seed, screenshots, copy lint, demo page generator
worker/                  Local model worker for your Mac, launchd plist and installer
tests/                   unit, integration, e2e
.claude/skills/          Project skills: design system, voice, feedback writing, reviews
```
