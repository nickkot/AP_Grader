# Legal to-do

Nothing here is resolved. Each item needs a decision or a signature before launch.

## College Board

- [ ] **Rubrics and scoring guidelines.** The app ships only rubric structure (rows, point values) and our own paraphrased decision rules (`src/lib/rubrics`). Licensed wording would go in the `licensedTextRef` slot. Needs a license before any College Board text appears in the product.
- [ ] **Released essays and samples** for the accuracy benchmark (the chosen benchmark source). License must cover storing them, running them through third-party models, and possibly the scanned handwritten pages for a transcription benchmark.
- [ ] **"AP" and "Advanced Placement" trademarks.** Product name, domain and marketing need review. The working name avoids "AP".
- [ ] **Practice prompts and documents.** Demo and starter prompts are original; DBQ documents are public-domain excerpts with citations (`src/lib/demo/content.ts`). Keep a source list for every document.

## Student data

- [ ] Data privacy agreement template for districts (FERPA, COPPA, state laws such as California SOPIPA).
- [ ] Subprocessor list: Vercel, Neon, AWS (S3, KMS), Inngest, Anthropic, Google (sign-in). Add Azure if word-geometry OCR is adopted.
- [ ] Anthropic: confirm commercial terms (no training on inputs) and request zero data retention for the organization.
- [ ] Privacy policy and terms of service.

## Local model worker

- [ ] When the worker is on, header-blanked page photos (and, if scoring is routed locally, redacted essays) are processed on the operator's own computer. The privacy policy and district agreements must name this, or the worker stays off for real student work.
- [ ] That computer needs FileVault, a login password, current macOS, and no other users. Ollama must stay bound to 127.0.0.1 with debug logging off. The worker keeps nothing on disk.
- [ ] Check the license of each local model before use (for example Qwen models' terms) for commercial use.

## Software licenses

- [x] mupdf (AGPL-3.0) removed in favor of unpdf (MIT) and @napi-rs/canvas (MIT).
- [ ] Review the full dependency license list before launch (`npx license-checker --summary`).

## Student accounts (practice)

- [ ] Privacy policy and terms must cover student accounts: students sign in with their own Google account, so their name and school email are stored. Numbered rosters keep names out of the roster, not out of student accounts.
- [ ] Data agreement template must cover practice essays written by students (not only essays uploaded by teachers).
- [ ] Safety flow for essays that disclose self-harm, abuse or threats (practice P2), reviewed by a counselor or child-safety advisor before any real student uses practice.
- [ ] Every practice prompt reviewed by an AP teacher, and every DBQ excerpt checked against an archive copy, before students see it.

## Integrations (later milestones)

- [ ] Google OAuth app verification for production (sensitive scopes come with Classroom in M5).
- [ ] PowerSchool, Infinite Campus, Skyward partner programs (M7).
- [ ] Clever and ClassLink app approval (M7).
