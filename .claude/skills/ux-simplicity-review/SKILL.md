---
name: ux-simplicity-review
description: Use before finishing any screen, flow or feature that a user will touch. A checklist that cuts steps, options and clutter so the product stays simple for busy teachers.
---

# UX simplicity review

Teachers have no time to learn software. Every screen should be usable on the first try, in a hurry, at the end of a long day. Run this review on every screen or flow you build or change, fix what fails, then note the result in the pull request or changelog.

## Click budgets for the core flows

These are hard limits. If a change makes a flow longer, find something to remove.

| Flow | Max clicks or taps |
| --- | --- |
| Create an assignment from a saved prompt | 4 |
| Print packets for all sections of a course | 3 |
| Photograph and upload a class set (after the camera opens) | 1 per page, 1 to finish |
| Open the next essay that needs review | 1 |
| Approve a score with no changes | 1 (or one key) |
| Post approved grades to the gradebook or SIS | 2 |

## Checklist

**Purpose**
- [ ] The screen has one job, and its title says what that job is.
- [ ] There is exactly one primary button, and it does that job.

**Less**
- [ ] Every element earns its place. Remove one thing before adding one thing.
- [ ] Options most teachers never change are hidden behind "More options" or moved to settings, with good defaults.
- [ ] No setting exists that we could decide for the teacher.
- [ ] No duplicate paths to the same action on one screen.

**Clarity**
- [ ] A teacher can tell what to do next without reading help text.
- [ ] Labels use teacher words (see `product-voice`).
- [ ] Status is visible at a glance: what is done, what needs review, what failed.
- [ ] Numbers are shown where they help decide ("6 need review").

**States**
- [ ] Empty state tells the teacher the next step, with the button to do it.
- [ ] Loading state shows progress for anything over 1 second, with counts for batches.
- [ ] Error state says what happened and how to fix it, and keeps the teacher's work.
- [ ] Partial results are usable while a batch is still running.

**Safety**
- [ ] Destructive actions confirm, and anything confirmable can be undone for a while instead.
- [ ] Nothing AI-generated reaches students, parents or the SIS without teacher approval.

**Speed**
- [ ] Keyboard shortcuts exist for repeated actions in review screens.
- [ ] The screen works one-handed on a phone if a teacher would use it on a phone (capture, quick review).

## Reference bar

Match the simplicity of Linear, Things and Apple Notes: few elements, obvious hierarchy, nothing decorative. If a screen looks busier than those, simplify it.
