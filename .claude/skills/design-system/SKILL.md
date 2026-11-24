---
name: design-system
description: Use before building or changing any UI screen, component or style. Locks in type, color, spacing, components and density, and bans generic AI-app styling.
---

# Design system

This app is a tool AP teachers use under time pressure, often late at night with 150 essays to get through. It should feel calm, dense, fast and obvious. Think of a well-made gradebook, not a startup landing page.

Never improvise a visual decision. If something below does not cover your case, pick the most boring option that fits, then add one line to `docs/DESIGN_DECISIONS.md`.

## Tokens

All values live in `app/globals.css` as CSS variables and in the Tailwind config. Never hardcode a hex value, pixel size or font in a component.

**Type**
- One UI typeface: Inter, or the system font stack. One monospace, for IDs and codes only.
- Scale (px): 12, 14, 16, 20, 24. Body text is 14 in dense views and 16 in reading views.
- Weights: 400 and 600 only.
- Essay text and transcriptions use a readable serif (Source Serif or Georgia) at 16-18 px with 1.6 line height, because teachers read them closely.

**Color**
- Neutral grays for almost everything: background, surfaces, borders, text.
- One accent color, a calm blue, for the primary action, links and focus rings. Nothing else is blue.
- Status colors only for status: green = approved or synced, amber = needs review, red = error or failed. Show them as small dots, badges or text, never large filled areas.
- AI confidence uses the amber and neutral scale, never a rainbow.
- Full dark mode through the tokens.

**Spacing and shape**
- 4 px grid: 4, 8, 12, 16, 24, 32, 48.
- Radius: 6 px for controls, 8 px for panels. Fully round only for avatars and status dots.
- 1 px light-gray borders separate things. Shadows only on menus, popovers and dialogs.

## Components

Use shadcn/ui. Never build a custom version of something shadcn already has.

| Need | Use |
| --- | --- |
| Many students or essays | Table or data grid, never a grid of cards |
| The main action on a screen | Button (default), one per screen |
| Secondary actions | Button (outline or ghost), or a menu |
| Destructive action | Button (destructive) inside a confirm dialog |
| Settings and forms | Form with labels above fields |
| Switching views within a page | Tabs |
| Details without leaving the page | Sheet (side panel) |
| Status | Badge with a status dot |
| Batch progress | Progress bar plus "18 of 30 scored" |

## Density

- Teachers scan whole classes. Default to tables with compact rows (36-40 px), sticky headers, sortable columns and keyboard navigation.
- Show what teachers act on (scores, counts, status). Put everything else one click away.
- Grids are full width up to about 1400 px. Reading views (essays, feedback) are a single column of about 720 px.

## Banned

- Gradients of any kind, including gradient text and borders.
- Glassmorphism, blur backgrounds, glows, neon.
- Sparkles, magic wands, robots or "AI" badges on AI features. An AI score is just a score with a confidence marker.
- Emoji anywhere in the UI.
- Decorative illustrations, blobs, 3D shapes, stock photos.
- Hero sections, giant headings or centered marketing layouts inside the app.
- Cards as a default layout. A card needs a reason: a self-contained object the teacher picks up or moves.
- A second accent color, colored section backgrounds, decorative colored icons.
- Animations longer than 200 ms, or any animation that does not explain a change of state.
- Icon-only buttons, except universal ones (close, search, more) with a tooltip.

## Before you finish

Run the `ux-simplicity-review` and `visual-qa` skills on every screen you built or changed.
