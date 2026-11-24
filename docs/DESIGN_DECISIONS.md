# Design decisions

Cases the design system does not cover, decided the boring way. The system itself: `docs/DESIGN.md`.

- **Mastery cells for rubric rows:** Khan Academy's progress states (not started, attempted, complete) mapped to rubric outcomes: green for full points, light green for partial, gray for zero, quiet outline for not scored. Zero is gray, not red, because a missed point is a learning step, not an error.
- **Needs review on a cell:** an amber ring around the cell, so it works with any fill. Amber always means "teacher attention".
- **Unmatched pages:** a warning banner (tinted background, amber left border, icon), the one pattern for things to deal with now.
- **Points control:** a segmented row of 40 px number buttons per rubric row. The selected value uses the accent because it is the teacher's choice, not a status.
- **Review layout:** essay card on the left (reading column), score cards on the right with the total and Approve pinned at the top. On phones the scores come first.
- **Up next card:** the only place with a tinted accent background, so the next step is easy to find.
- **Evidence highlight:** a pale yellow mark, stronger for the quote just clicked. Yellow is not a status color here.
- **Camera screen:** full-screen black with a round white shutter, the one place the app departs from the canvas, because it is a camera.
- **Keyboard hints:** shown under the review panel on laptops, hidden on phones.
- **Secondary actions on phones:** shown after the Up next card, so the main action is the first thing on screen.
