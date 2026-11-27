# Decisions

Simplest reasonable option, recorded so it can be revisited. Newest last.

## MVP scope (2026-11-24)

The first build is a smaller MVP than milestones 1 to 3 in `docs/PLAN.md`: the handwritten loop for one teacher, for APUSH DBQ and AP Lang Argument. Left for later: organizations and roles beyond "teacher", tenant row-level security, Microsoft/Clever/ClassLink sign-in, the accuracy harness and its CI gate (M3), calibration, LMS and SIS integrations, student accounts, billing.

## Stack

| Decision | Why |
| --- | --- |
| Next.js 16 App Router, TypeScript strict, Tailwind 4 | Spec default |
| `cacheComponents` and partial prefetching off | Nearly every screen is per-teacher request-time data; Cache Components would mean a Suspense boundary around every session read for no gain |
| Drizzle ORM with postgres.js, `prepare: false` | Typed, plain SQL; works with Neon's pooled endpoint |
| Better Auth (Google + dev-only email login) | Auth data stays in our database, which keeps student identity out of another vendor and shortens DPAs. Supports MFA, account linking and generic OIDC for later |
| Dev login refused on a public https `APP_URL` | `next build` runs as production locally and in CI too, so the deployed URL is what identifies a real deployment |
| A deployed site must use `MODEL_MODE=anthropic`, `JOBS_DRIVER=inngest`, `STORAGE_DRIVER=s3` | Prevents silently serving fake scores or losing uploads |
| shadcn/ui components written in by hand | The shadcn registry is blocked from the build container; the components are copy-in source either way |
| System font stack, Georgia-class serif for essays | Allowed by the design system; avoids a font download at build |
| Inngest for jobs, with an in-process "inline" driver for dev and tests | Managed retries and concurrency in production; no extra process locally |
| Browser uploads straight to S3 with presigned PUT | Vercel functions cap request bodies at 4.5 MB; phone photos are larger |
| Photos converted to JPEG (max 2400 px) in the browser before upload | Smaller uploads on school wifi; handles HEIC on iPhones; one format on the server |
| In-app camera (getUserMedia) with a shutter button | Meets the "1 tap per page" budget. Auto-capture and edge detection come in M6 |
| PDF rasterizing with unpdf (MIT, bundles pdf.js) and @napi-rs/canvas (MIT) | mupdf was tried first and dropped: it is AGPL-3.0 |
| QR reading with zxing-wasm, wasm loaded from node_modules | It defaults to a CDN; we never fetch code at runtime |

## Data and privacy

| Decision | Why |
| --- | --- |
| Ownership checks in one data-access module instead of RLS for the MVP | One teacher per account in the MVP. Tenant RLS arrives with the organization model (M1 proper) |
| QR codes hold an opaque 12-character token only | A lost page reveals nothing; the token maps to student and page in our database |
| The image sent to the model has the header band blanked above the QR code | The printed student name never reaches the model. Pages without a QR get the top 12% blanked |
| Text redaction: roster full names, the author's name in short header lines and after "my name is", and 5+ digit numbers | Redacting a student's surname everywhere would break history essays ("Jackson vetoed the bank") |
| Reprinting reuses existing QR tokens | Sheets from an earlier print still match |
| A newer photo of the same page replaces the older one | Retakes just work; the old photo stays stored for the record |
| Original photos kept, processed copies stored separately | Record of authenticity; the model sees only the processed copy |

## Scoring

| Decision | Why |
| --- | --- |
| Haiku 5.5 transcribes; pages under 0.8 mean confidence are retried on Sonnet 5.5 | User chose cheaper models from day one; the retry protects hard handwriting |
| Sonnet 5.5 scores, adaptive thinking, effort `medium` (env `SCORING_EFFORT`) | Cost; to be checked against the benchmark in M3 |
| One call per rubric row; the first row runs alone to write the prompt cache, the rest run in parallel | Rows scored independently as the spec asks, at cached-prefix prices |
| Server-side refusal fallback (`fallbacks: "default"`) on Sonnet scoring calls | Recommended default for Sonnet 5.5; essays about violence in history should not fail outright |
| Structured outputs validated with Zod; one retry on a schema or rule failure, then flag the row | Spec |
| Quotes must appear verbatim (ignoring whitespace, quote and dash style) or the row is flagged | `student-feedback-writing`: "quote or it did not happen" |
| Flags: confidence below 0.7, borderline, unverified quote, feedback rule broken, row failed | Teacher sees what to check first |
| Confirming a transcription sends the essay straight to scoring | One click instead of two. Auto-confirm thresholds come in M6 |
| Approving accepts every row not yet reviewed | Meets "approve with no changes: 1 click or key". Approve moves to the next essay that needs review |
| Assignment locks (prompt, sources, rubric) at first score | Scores stay tied to what students saw. Full assignment versioning comes later |
| Prompt text lists banned phrases built from `src/lib/copy/banned.ts` | One source of truth for the prompt, the runtime check, tests and the CI copy lint |

## Phone upload links (2026-11-24)

| Decision | Why |
| --- | --- |
| The upload screen on a computer shows a QR code that opens a camera page on the teacher's phone, with no sign-in | Signing in on a phone in the middle of class is the slowest step. The printed sheets' QR codes still work too, after sign-in |
| The link can only add pages to one assignment, for 2 hours, up to 400 pages | Anyone who photographs the screen gets nothing but a way to add pages to the matching queue. It cannot read essays, scores or the roster |
| Only a SHA-256 hash of the link token is stored | A database leak does not hand out working links |
| Teacher and phone uploads share one module (`src/lib/uploads.ts`) | Same checks either way: the key, the batch and the page must belong to the assignment |

## Numbered rosters (2026-11-24)

| Decision | Why |
| --- | --- |
| A class lists students by name or by number. A numbered class stores no names at all | Students are minors. A teacher who keeps the name key outside the app removes the most sensitive field from our database |
| A named class can switch to numbers. The teacher downloads the key first, and the switch is refused if the roster changed since | Names are deleted for good, so the key is the only record. The check stops a key and the new numbers from disagreeing |
| Numbers follow the roster's alphabetical order, then students removed from the roster | Predictable, and the same order the key shows |
| Export has a "Student number" column for numbered classes | Matches the teacher's key and gradebook without names |
| Page photos taken before a switch keep the printed names | Rewriting stored photos is out of scope. The dialog says so |

## Student practice, P1 (2026-11-24)

| Decision | Why |
| --- | --- |
| `user.kind` is `teacher` or `student`; teacher pages and actions refuse students, practice pages refuse teachers | One account table for Better Auth, one check in `requireTeacher` and `requireStudent` |
| A new account becomes a student when it joins a class. An account that owns classes cannot join | No separate student sign-up. Teachers cannot end up in practice by mistake |
| Students join with the class code, then their name or number. The roster is never shown | A code alone reveals no names of minors. 10 failed tries per hour stops guessing |
| Practice essays are `submission` rows with `context = practice` and no assignment | One scoring pipeline, as the plan requires. Teacher queries always filter by assignment, and `getSubmissionForTeacher` refuses practice rows |
| Practice prompts are code, versioned like rubrics | No authoring UI yet. A table comes when teachers or districts write prompts |
| The draft lives on the attempt, with a sequence number | One current draft is all P1 needs. A conditional update makes an older save a no-op |
| After the deadline plus 60 seconds, only the last saved draft is scored | Students cannot keep typing after time is up. The grace covers a slow network at zero |
| Students see practice scores right away, labeled "practice estimate" | The practice spec asks for results in under a minute. Teacher approval still gates every assignment score |
| 10 scored practice essays per student per day | Bounds cost until per-plan limits (P8) |
| Google sign-in rate limit raised to 300 per minute per IP | Better Auth allows 3 sign-ins per 10 seconds per IP. A class signing in together shares one school IP |
| Sign-in `next` must be a same-site path | `//host` was accepted and would send people to another site after sign-in |

## Local model worker (2026-11-27)

| Decision | Why |
| --- | --- |
| One function, `complete()` in `src/lib/llm`, makes every model call. Tasks name the model per provider | Swapping providers or models is a setting, not a code change. Fallback to the cloud lives in one place |
| The queue is a Postgres table (`llm_jobs`) in the app database, not Supabase or a broker | The app already runs on Postgres with Drizzle. One less service |
| The worker talks to the site over HTTPS with one bearer token; it never gets database credentials | A stolen laptop or token can claim jobs, not read the database. The token rotates in one place. Matches "service role key only on the server" |
| Claims use `FOR UPDATE SKIP LOCKED`, a lease and a fresh token per claim. Every write checks the token | Two workers never get the same job, and a worker that slept cannot overwrite the cloud's answer |
| A job goes local only when a worker with its model checked in within 90 seconds and fewer than 5 jobs wait | A Mac that is off never costs anyone a 10 minute wait. A laptop is slow, so a long queue would cost more time than it saves |
| A local job unfinished by its deadline, or whose lease lapses, runs in the cloud. Inngest sleeps durably until then | Users never get stuck. The inline driver uses a timer for local development |
| The server builds the prompt when the worker claims; job rows hold only ids, and a local answer is cleared once it is saved | The worker stays small. Essays never sit in the queue table, and a page replaced before the claim is simply cancelled |
| The worker only answers the model call. Retries, quote checks and saving stay on the server | Local and cloud answers go through the same checks and the same code |
| Reading pages runs locally by default once a worker is set up. Scoring stays in the cloud until the local model passes the benchmark | Transcription is checked by the teacher before scoring; a score reaches students |
| Student practice and the hard-page re-read always use the cloud | Students wait on practice. A re-read exists because the first reading was weak |
| Cloud calls are recorded in `llm_jobs` too | One table answers "what did we spend and what did we save" |
| Savings are the local tokens priced at the cloud model's list price, with no caching discount | Simple and slightly generous. The admin page says so |
| `/admin/llm` is visible only to `ADMIN_EMAILS`; anyone else gets a 404 | Spend and worker names are operator information, not teacher information |

## Known limits

- Copier PDFs saved as JPEG 2000 will not render (the bundled pdf.js has no JPX decoder). Ordinary JPEG and JBIG2 scans work.
- Evidence links to the page, not the exact spot on the photo. Word positions need an OCR provider with geometry (open question in `docs/PLAN.md`).
- No accuracy benchmark yet: scores from real models are unmeasured until M3.
