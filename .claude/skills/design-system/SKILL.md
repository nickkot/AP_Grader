---
name: design-system
description: Use before building or changing any UI screen, component or style. Locks in type, color, spacing, components and density, and bans generic AI-app styling. Patterns adapted from Khan Academy's open-source Wonder Blocks; see docs/DESIGN.md.
---

# Design system

Teachers use this under time pressure, and students will too. It should feel like a well-made learning product: calm, friendly, very clear about progress and about what to do next. The reference is the structure of Khan Academy's Wonder Blocks (MIT): off-white canvas, white cards, Lato, soft elevation, visible progress, one "Up next" action. Never its brand: no Khan Academy name, logo, signature blue or purple, characters or illustrations.

Full rationale and token tables: `docs/DESIGN.md`. If something below does not cover your case, pick the most boring option that fits, then add one line to `docs/DESIGN_DECISIONS.md`.

## Tokens

All values live in `src/app/globals.css` as CSS variables mapped into Tailwind. Never hardcode a hex value, pixel size or font in a component.

**Type**
- Lato 400 and 700 (self-hosted, `@fontsource/lato`). One monospace for codes only.
- Scale (px): 12, 14, 16, 20, 24, 28. Body text is 16. Dense tables may use 14.
- Essay text and transcriptions use the serif at 17 px with 1.6 line height.

**Color**
- Canvas `#F7F8FA` behind everything; surfaces are white cards.
- One accent, `primary` (our own deep blue), for the primary action, links, focus and selection. Nothing else is blue.
- Status: `success` (earned, approved), `warning` (needs review; use `warning-text` for amber text), `critical` (errors). Each has a `-soft` tint for pills and banners.
- Progress: mastery cells use `success`, `progress-partial`, `not-earned`, and a dashed outline for not scored. Color is never the only signal: cells always show points, pills always have words.
- Full dark mode through the tokens.

**Spacing and shape**
- Spacing: 2, 4, 6, 8, 12, 16, 24, 32, 48, 64. Cards pad 24 (16 on phones). Sections 32 apart.
- Radius: 4 (mastery cells), 8 (controls), 12 (cards), full (pills, avatars).
- Elevation: `shadow-low` cards, `shadow-mid` menus, `shadow-high` dialogs.
- Focus: the double ring (surface inside, primary outside) on every interactive element.

## Components

Use shadcn/ui primitives styled with these tokens. Never build a custom version of something shadcn already has.

| Need | Use |
| --- | --- |
| A grouped object (a class, an assignment, a rubric row) | `Card` |
| Many students or essays | Table inside a card, or the mastery grid. Never a grid of student cards |
| The one thing to do next | `UpNext` card holding the single primary button |
| Secondary actions | Button `secondary` or `tertiary`, or a menu |
| Destructive action | Button `destructive` inside a confirm dialog |
| Status or count | `Pill` |
| Something the teacher should know now | `Banner` (info, success, warning, critical) |
| Batch or class progress | `ProgressBar` plus counts in words ("18 of 30 scored") |
| Rubric outcomes across a class | Mastery grid with `MasteryCell` and `MasteryLegend` |
| Switching views within a page | Tabs |
| Details without leaving the page | Sheet |

## Density

- Grids are full width up to about 1400 px. Reading views (essays, feedback) are about 720 px.
- Table rows 44 px, sticky headers. Show what people act on; put everything else one click away.

## Banned

- Gradients of any kind, glassmorphism, blur backgrounds, glows, neon.
- Sparkles, magic wands, robots or "AI" badges. An AI score is a score with a confidence marker.
- Emoji anywhere in the UI.
- Decorative illustrations, characters, mascots, blobs, 3D shapes, stock photos.
- Hero sections or marketing layouts inside the app.
- A second accent color, colored section backgrounds (tints are only for pills, banners, the Up next card and mastery cells).
- Animations longer than 200 ms, or any animation that does not explain a change of state.
- Icon-only buttons, except universal ones (close, search, more, menu) with a label for screen readers.
- Anything from Khan Academy's brand: name, logo, signature colors, characters, gems, streaks.

## Before you finish

Run the `ux-simplicity-review` and `visual-qa` skills on every screen you built or changed.
