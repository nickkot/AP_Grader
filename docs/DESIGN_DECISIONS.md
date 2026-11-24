# Design decisions

Cases the design system does not cover, decided the boring way.

- **Unmatched pages banner:** neutral surface with an amber dot, not an amber fill, because status colors never fill large areas.
- **Points control:** a segmented row of number buttons (0 to max) per rubric row. The selected value uses the accent color because it is the teacher's current choice, not a status.
- **Review layout:** essay on the left (720 px reading column), scores on the right (460 px, sticky). On phones the scores come first so a quick check needs no scrolling.
- **Evidence highlight:** a pale yellow mark, stronger for the quote just clicked. Yellow is not a status color in this app, so it cannot be mistaken for "needs review".
- **Low-confidence words:** amber underline with a pale amber background, per "AI confidence uses the amber and neutral scale".
- **Camera screen:** full-screen black with a round white shutter, the one place the app departs from the gray surfaces, because it is a camera.
- **Keyboard hints:** shown under the review panel on laptops, hidden on phones.
