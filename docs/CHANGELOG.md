# Changelog

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
