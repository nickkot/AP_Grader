# Design: learning-product patterns from Khan Academy

Status: implemented on branch `design/learning-ui`.

## Why

The first MVP looked like a dense admin tool. Teachers and, later, students should find it as approachable as the learning products they already use. Khan Academy is the reference most AP teachers know: calm, friendly, very clear about progress and about what to do next.

## Source

Khan Academy publishes its design system, **Wonder Blocks**, under the MIT license (`@khanacademy/wonder-blocks-*` on npm, copyright 2018 Khan Academy). We read the published tokens (`@khanacademy/wonder-blocks-tokens` 18.2.1) and component APIs and adapted the **patterns**. We do not depend on the packages; our components stay on shadcn/ui and Tailwind.

## What we adapt, and what we do not

| We adapt (patterns) | We do not copy (brand) |
| --- | --- |
| Off-white canvas with white content cards | The Khan Academy name, logo or wordmark |
| Lato for UI text, 16 px body text | Their signature blue (`#1865F2`) and mastery purple |
| Spacing scale 2 to 64 px with 4 and 8 as the main steps | Characters, illustrations, gems, streaks, Khanmigo styling |
| Radii 4, 8, 12 px, pills fully round | Their page header and navigation chrome as-is |
| Three elevations of soft shadow | Any marketing copy or imagery |
| Progress states: not started, attempted, complete | |
| Status banners: tinted background, colored border, icon | |
| Double focus ring (white inside, accent outside) | |
| Button hierarchy: primary, secondary, tertiary | |
| Course sidebar and an "Up next" card for the next step | |
| Mastery grid: students down, skills across, colored cells | |

A teacher should feel the same ease of use, and never mistake this app for Khan Academy.

## Principles

1. **Progress is visible at a glance.** Every class, assignment and rubric row shows where things stand with color plus a number or label. Color is never the only signal.
2. **One clear next step.** Each screen leads with an "Up next" card holding the single primary action, with one sentence saying why.
3. **Calm structure.** Off-white page, white cards, generous spacing, one accent color. Nothing decorative.
4. **Accessible by default.** 16 px body text, WCAG AA contrast in both themes, a visible double focus ring, hit targets of 40 px or more on touch.
5. **Plain words.** `product-voice` still governs all copy. Friendly does not mean cheerful: no exclamation marks, no praise.

## Tokens

All tokens live in `src/app/globals.css`. Light and dark themes switch through `prefers-color-scheme`.

### Color

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#F7F8FA` | `#16181D` | Page background |
| `surface` | `#FFFFFF` | `#1F2228` | Cards, tables, panels |
| `surface-muted` | `#EDEEF0` | `#2A2D34` | Hover rows, wells, disabled fills |
| `foreground` | `#21242C` | `#E9EAEC` | Body text |
| `muted-foreground` | `#5F6167` | `#A4A7AD` | Secondary text |
| `border` | `#DBDCDD` | `#363941` | Card and table borders |
| `input` | `#909296` | `#5A5E66` | Control borders |
| `primary` | `#2F5CB8` | `#8AB0F5` | Primary actions, links, focus ring, selection. Our own blue, deeper and less saturated than Khan Academy's |
| `primary-soft` | `#ECF1FB` | `#22304D` | Selected rows, Up next card background |
| `success` / `success-soft` | `#0B7C18` / `#EBF8EC` | `#5FCB6A` / `#1D3322` | Earned, approved |
| `progress-partial` | `#8FD19A` | `#31653A` | Rubric row partly earned |
| `warning` / `warning-soft` | `#B8840E` / `#FFF9EB` | `#F2C14E` / `#3A3020` | Needs review, words to check |
| `warning-text` | `#7A5600` | `#F5CD6E` | Amber text on light backgrounds (`warning` itself is for rings, dots and borders) |
| `critical` / `critical-soft` | `#C42514` / `#FCEEEC` | `#F08A7E` / `#3D2220` | Errors, failed |
| `not-earned` | `#D5D7DB` | `#454952` | Rubric row scored 0 |

### Type

Lato 400 and 700, self-hosted from `@fontsource/lato` (OFL). Essay text stays in a serif (Source Serif or Georgia) at 17 px with 1.6 line height.

| Token | Size / line height | Use |
| --- | --- | --- |
| `text-xs` | 12 / 16 | Labels in grids, captions |
| `text-sm` | 14 / 20 | Dense tables, secondary text |
| `text-base` | 16 / 24 | Body text, controls |
| `text-lg` | 20 / 28 | Card titles |
| `text-xl` | 24 / 32 | Page titles on phones |
| `text-2xl` | 28 / 36 | Page titles |

Weights: 400 and 700 only.

### Spacing, radius, elevation

- Spacing: 2, 4, 6, 8, 12, 16, 24, 32, 48, 64 px. Cards pad 24 px (16 px on phones). Sections sit 32 px apart.
- Radius: 4 px (pills inside grids, mastery cells), 8 px (controls), 12 px (cards), full (pills, avatars).
- Elevation: `shadow-low` on cards, `shadow-mid` on menus and popovers, `shadow-high` on dialogs. All soft and neutral.
- Focus: 2 px surface-colored ring inside a 2 px primary ring, on every interactive element.

## Components

| Component | Pattern | Notes |
| --- | --- | --- |
| `Button` | primary (filled), secondary (outlined, accent text), tertiary (text only), destructive | One primary per screen. Height 40 px, 44 px for large |
| `Card` | White, 12 px radius, border plus low shadow | The default container for a grouped thing |
| `Pill` | Fully round label with tinted background | Status and counts: "Approved", "3 to review" |
| `Banner` | Tinted background, colored left border, icon, text, optional action | Info, success, warning, critical |
| `ProgressBar` | Segmented bar: approved, needs review, in progress, not started | Always followed by counts in text |
| `MasteryCell` | 32 px square, 4 px radius, color fill plus the points number | See the next table |
| `MasteryLegend` | The cell states with labels | Shown under every grid |
| `UpNext` | Card on `primary-soft` with a title, a reason, one primary button | Top of class and assignment pages |
| `Sidebar` | Course-grouped class list with assignments nested, current item marked | Collapses into a menu on phones |
| `StatTile` | Big number plus label | Class page summary |

### Mastery cells (rubric outcomes)

Modeled on Khan Academy's progress states, applied to rubric rows. Every cell shows the points as text, so the color is never the only signal.

| State | Fill | Content |
| --- | --- | --- |
| Earned (full points) | `success` | Points, white text |
| Partly earned | `progress-partial` | Points |
| Not earned (0) | `not-earned` | 0 |
| Not scored yet | Thin `border` outline on the canvas color | Dash |
| Flagged for review | Any of the above plus a 2 px `warning` ring | Same |

## Screens

| Screen | Change |
| --- | --- |
| App shell | Left sidebar on laptops (classes grouped by course, assignments nested). Top bar with a menu button on phones |
| Classes | Course sections with one card per class: name, students, assignments, approval progress bar. "Create class" card at the end |
| Class | Up next card, stat tiles, assignments as cards with progress bars, roster in a card |
| Assignment | Up next card (print, upload, check, review, or export), segmented progress bar, mastery grid with legend and a per-row "earned by" footer |
| Essay review | Row cards: label, outcome pill, points control, evidence quotes, comment. Approve in the Up next position |
| Transcription check | Banner explaining what to check, photo and text in cards |
| Upload | Big camera button, secondary options as cards, progress in a card |
| Sign in | Centered card on the canvas |

## Changes to the design-system skill

`.claude/skills/design-system/SKILL.md` is updated to match this document. In short:
- Cards are now the default container for a grouped object. Large lists of students stay tables.
- Status and progress colors may fill mastery cells, pills, banners and progress bars, never whole sections.
- Body text is 16 px, Lato. Dense tables may use 14 px.
- Still banned: gradients, glassmorphism, glows, sparkles or AI badges, emoji, decorative illustrations, characters, a second accent color, animations over 200 ms.
