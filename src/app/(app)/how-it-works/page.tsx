import type { Metadata } from "next";
import Link from "next/link";

import { PageBody, PageHeader, SectionTitle } from "@/components/page-header";
import { Kbd } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "How it works" };

type Step = { title: string; lines: React.ReactNode[] };

const linkClass = "font-bold text-primary underline-offset-4 hover:underline";

const STEPS: Step[] = [
  {
    title: "Create a class",
    lines: [
      <>
        Choose <Link href="/classes/new" className={linkClass}>Create class</Link>, pick the course and name the class.
      </>,
      "Paste your roster, one student per line. First Last and Last, First both work.",
      "To keep names out of the app, list students by number instead.",
      "A class that has names can switch to numbers from its roster.",
    ],
  },
  {
    title: "Create an assignment",
    lines: [
      "Pick the essay type: APUSH DBQ or AP Lang argument.",
      "Paste the prompt and add the documents in the order students will see them.",
      "Set the time limit and the number of answer pages per student.",
      "The prompt, documents and rubric lock once the first essay is scored.",
    ],
  },
  {
    title: "Print packets",
    lines: [
      "One PDF holds the prompt, the documents and answer sheets for each student.",
      "Every answer page carries the student's name or number and a QR code.",
      "Spare sets have a blank name line for absent or new students.",
    ],
  },
  {
    title: "Give the timed write",
    lines: ["Students write on their own answer sheets. Collect the pages in any order."],
  },
  {
    title: "Upload the pages",
    lines: [
      "On your computer, open the assignment and choose Upload photos.",
      "Choose Show code and scan it with your phone camera. No sign-in on the phone.",
      "Take one photo per page, flat and in good light, with the QR code in view.",
      "You can also choose photos you already took, or upload one PDF from the copier.",
      "Pages find their student by QR code. Pages without a readable code wait on Match pages.",
    ],
  },
  {
    title: "Check each transcription",
    lines: [
      "Compare the typed text with the photo. Words that were hard to read are highlighted.",
      "Fix misread words, then choose Confirm and score.",
      "The printed name is blanked out before the page is read.",
      "Spelling and grammar errors from transcription never count against the student.",
    ],
  },
  {
    title: "Review the scores",
    lines: [
      "Each rubric row is scored on its own, with quotes from the essay as evidence.",
      "Every quote is checked against the essay. Rows that need a closer look are flagged.",
      "Change points, edit the comment for the student, then choose Approve.",
      "Scores stay private until you approve them.",
    ],
  },
  {
    title: "Export the scores",
    lines: [
      "Choose Export CSV on the assignment page for points per row and totals.",
      "Comments for students are included for approved essays.",
    ],
  },
];

const FLAGS: [string, string][] = [
  ["Low confidence", "An AP reader might score this row differently. Read it first."],
  ["Close call", "The essay sits between two point values for this row."],
  ["Quote not found", "A quote is not in the essay as written, or the row has no quote."],
  ["Not scored", "Scoring failed for this row. Choose Score again from the menu."],
  ["Check comment", "The comment for the student is too long or too vague. Edit it before you approve."],
];

const SHORTCUTS: [React.ReactNode, string][] = [
  [<Kbd key="a">A</Kbd>, "Approve the essay"],
  [
    <span key="jk">
      <Kbd>J</Kbd> <Kbd>K</Kbd>
    </span>,
    "Next or previous student",
  ],
  [<Kbd key="n">N</Kbd>, "Next essay that needs review"],
  [
    <span key="ud">
      <Kbd>↑</Kbd> <Kbd>↓</Kbd>
    </span>,
    "Move between rubric rows",
  ],
  [
    <span key="num">
      <Kbd>0</Kbd> to <Kbd>9</Kbd>
    </span>,
    "Set points on the selected row",
  ],
  [<Kbd key="enter">Enter</Kbd>, "Accept the score on the selected row"],
  [
    <span key="ce">
      <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>
    </span>,
    "Confirm a transcription and score it",
  ],
];

export default async function HowItWorksPage() {
  await requireTeacher();

  return (
    <PageBody wide={false}>
      <PageHeader
        title="How it works"
        description="Eight steps from roster to gradebook. On each class and assignment, the Up next card shows the next step."
      />

      <ol className="flex flex-col gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <Card className="flex gap-4 p-4 sm:p-6">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-lg font-bold">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h2>
                {step.lines.map((line, j) => (
                  <p key={j} className="text-base">
                    {line}
                  </p>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-4">
        <SectionTitle>Flags on a rubric row</SectionTitle>
        <Card>
          <CardContent>
            <dl className="flex flex-col gap-3">
              {FLAGS.map(([name, meaning]) => (
                <div key={name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <dt className="shrink-0 text-base font-bold sm:w-40">{name}</dt>
                  <dd className="text-base text-muted-foreground">{meaning}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>Typed essays</SectionTitle>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-base">Open a student who has no pages yet.</p>
            <p className="text-base">Paste the essay, or import a .docx, .pdf or .txt file. Then choose Score essay.</p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionTitle>Keyboard shortcuts</SectionTitle>
        <Card>
          <CardContent>
            <dl className="flex flex-col gap-3">
              {SHORTCUTS.map(([keys, action]) => (
                <div key={action} className="flex items-center gap-4">
                  <dt className="w-28 shrink-0 text-sm">{keys}</dt>
                  <dd className="text-base">{action}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">On a Mac, Cmd works in place of Ctrl.</p>
          </CardContent>
        </Card>
      </section>
    </PageBody>
  );
}
