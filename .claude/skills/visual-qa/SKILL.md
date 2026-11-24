---
name: visual-qa
description: Use before calling any UI work done. Takes Playwright screenshots of changed screens at phone and laptop widths, in light and dark mode, then looks at them and fixes problems.
---

# Visual QA

You cannot judge a screen you have not seen. Code that compiles can still look broken, cramped or generic. Before marking any UI task complete, screenshot it, look at every screenshot, and fix what is wrong.

## Steps

1. **Seed realistic data.** Use the demo seed: a class of 32 students, long and short names, a mix of scored, needs-review, failed and empty states, and at least one handwritten essay. Never review a screen with only one tidy row.
2. **Capture.** Run `npm run screenshots -- <route>` (create this Playwright script in `scripts/screenshots.ts` if it does not exist). For each changed route, capture:
   - laptop: 1440 x 900
   - phone: iPhone 14 device profile
   - light and dark mode
   - empty, loading, populated and error states where they exist
   Save to `screenshots/<route>/<viewport>-<theme>-<state>.png`. Keep this folder out of git.
3. **Look at every screenshot** with the Read tool. Do not skip any.
4. **Check against this list:**
   - Text is never cut off, overlapping or wrapping awkwardly.
   - Long student names and long essay titles truncate cleanly with a tooltip.
   - Tables stay readable on a phone (horizontal scroll or a stacked layout), with no page-level horizontal scroll.
   - One primary button is visually obvious; nothing else competes with it.
   - Spacing follows the 4 px grid; alignment lines up.
   - Contrast is readable in both themes, including status badges and disabled states.
   - Nothing from the `design-system` banned list appears.
   - Essay text and page photos are large enough to read without zooming on a laptop.
   - The screen would not look out of place next to Linear or Apple Notes.
5. **Fix and recapture** until every item passes. Do not stop after one pass if something is still off.
6. **Run accessibility checks** with axe on the same routes (`@axe-core/playwright`) and fix any serious or critical issues.
7. **Report** in the pull request or changelog: routes checked, viewports, issues found and fixed.

## Never

- Never say a screen looks good without having viewed its screenshot in this session.
- Never mark UI work done with a known visual bug unless you list it as an open issue.
