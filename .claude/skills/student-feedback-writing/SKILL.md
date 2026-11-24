---
name: student-feedback-writing
description: Use when writing or changing scoring prompts, feedback templates, the comment bank defaults, or any text the model generates for teachers or students about an essay. Makes AI feedback specific, quoted, rubric-tied and free of generic filler.
---

# Student feedback writing

Feedback is the main thing this product produces. Students and teachers recognize generic AI feedback instantly, and once they do, they stop reading it. Every piece of feedback must sound like a sharp AP reader who actually read this essay.

## The shape of good feedback

For each rubric row, feedback has three parts, in this order:

1. **Verdict:** the point earned or missed, named in rubric terms. "Contextualization: not earned."
2. **Evidence:** a short quote from the student's own essay (under 25 words) showing why.
3. **Next step:** one concrete action the student can take on the next essay. Not a principle, an action.

Length limits:
- Student-facing feedback per row: at most 3 sentences, about 60 words.
- Teacher-facing justification per row: at most 2 sentences, plus the quote.
- Reading level: grades 9-10. Short words, active voice.

## Rules

- **Quote or it did not happen.** Every claim about the essay points to the student's words. If you cannot quote evidence, lower your confidence and flag the row for review.
- **One next step, not five.** Pick the single change that would most likely earn the point.
- **Be specific to the prompt.** Name the actual historical development, text, rhetorical choice or argument. "Connect the Market Revolution to the rise of the Whig Party," not "Add more context."
- **Name what worked** only when it earned a point, and say why in rubric terms. No praise for effort.
- **Never guess at the student.** No assumptions about their background, intent or feelings. Never adjust tone or content based on names or any identity cues.
- **Do not penalize transcription.** On handwritten essays, never comment on spelling or grammar that could come from OCR errors.
- **Do not invent rubric points** or comment on things the rubric does not score, unless the teacher's custom criteria ask for it.

## Banned in feedback

- Openers and filler: "Great job!", "Nice work", "Overall, this essay…", "You did a wonderful job of…", "Keep up the good work", "It's clear that you…", "This essay demonstrates…".
- Vague advice: "add more analysis," "be more specific," "elaborate further," "strengthen your argument," "consider adding," with nothing concrete attached.
- Hedging stacks: "may perhaps want to consider possibly…".
- Exclamation marks, emoji, em dashes.
- Summaries that restate the essay back to the student.

## Examples

**Bad (AP Lang, sophistication):**
> Great job on this essay! You did a wonderful job of analyzing the rhetorical choices. To improve, consider adding more complexity and strengthening your argument to show a deeper understanding.

**Good:**
> Sophistication: not earned. Your thesis says Chavez "uses pathos to persuade," which names a strategy but not why it works for his audience. Next time, explain the tension he is managing, for example that he asks for nonviolence from people who have faced violence.

**Bad (APUSH DBQ, sourcing):**
> You should analyze the documents more thoroughly and explain their significance.

**Good:**
> Sourcing: earned for 1 of the 2 documents needed. You explain how Document 3's audience (Congress) shapes its argument. Do the same for one more document: Document 5 is a private letter, so ask why its author could be more honest there.

## Testing

When you change a scoring or feedback prompt:
1. Run it on the benchmark essays for that essay type.
2. Check every output against the banned list automatically (add a test).
3. Check that every row has a quote that appears verbatim in the essay (add a test).
4. Check student-facing length and reading level (add a test).
5. Read 10 outputs yourself and rewrite the prompt if any of them could have been written without reading the essay.
