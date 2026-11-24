import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WritingRoom } from "@/app/(student)/practice/essays/[id]/writing-room";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageBody, PageHeader, SectionTitle } from "@/components/page-header";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banner, Card, CardContent, UpNext } from "@/components/ui/card";
import { retryPracticeScoring } from "@/lib/actions/practice";
import { isUuid } from "@/lib/data";
import { attemptResult, getAttempt, type RowResult } from "@/lib/practice/attempts";
import { essayTypeLabel } from "@/lib/practice/labels";
import { practicePrompt } from "@/lib/practice/prompts";
import { requireStudent } from "@/lib/session";

export const metadata: Metadata = { title: "Practice essay" };

const DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

function Outcome({ row }: { row: RowResult }) {
  if (row.failed || row.points === null) return <Pill tone="neutral">Not scored</Pill>;
  if (row.points >= row.maxPoints) return <Pill tone="ok">Earned</Pill>;
  if (row.points > 0) return <Pill tone="progress">{`${row.points} of ${row.maxPoints}`}</Pill>;
  return <Pill tone="neutral">Not earned</Pill>;
}

export default async function PracticeEssayPage(props: PageProps<"/practice/essays/[id]">) {
  const student = await requireStudent();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const attempt = await getAttempt(student.id, id);
  if (!attempt) notFound();
  const prompt = practicePrompt(attempt.promptKey);
  if (!prompt) notFound();

  if (!attempt.submittedAt) {
    return (
      <WritingRoom
        attemptId={attempt.id}
        mode={attempt.mode}
        readingEndsAt={attempt.readingEndsAt?.toISOString() ?? null}
        deadlineAt={attempt.deadlineAt?.toISOString() ?? null}
        serverNow={new Date().toISOString()}
        draftText={attempt.draftText}
        draftSeq={attempt.draftSeq}
        prompt={{ title: prompt.title, promptText: prompt.promptText, sources: prompt.sources, typeLabel: essayTypeLabel(prompt) }}
      />
    );
  }

  const result = await attemptResult(attempt);
  const scoring = !result || result.status === "scoring";
  const retry = retryPracticeScoring.bind(null, attempt.id);

  return (
    <PageBody wide={false}>
      <AutoRefresh active={scoring} />
      <PageHeader
        back={{ href: "/practice", label: "Practice" }}
        title={prompt.title}
        description={`${essayTypeLabel(prompt)} · ${attempt.mode === "timed" ? "Timed" : "Untimed"} · ${DATE.format(attempt.submittedAt)}`}
      />

      {attempt.autoSubmitted && <Banner tone="info">Time ran out, so your essay was submitted as it was.</Banner>}

      {scoring ? (
        <Card>
          <CardContent className="flex flex-col gap-1">
            <p className="text-lg font-bold">Scoring your essay</p>
            <p className="text-base text-muted-foreground">Each part of the rubric is scored on its own. This takes about a minute.</p>
          </CardContent>
        </Card>
      ) : result.status === "failed" ? (
        <Banner
          tone="critical"
          action={
            <form action={retry}>
              <Button type="submit" size="sm" variant="outline">
                Score again
              </Button>
            </form>
          }
        >
          {result.error ?? "Scoring failed."} Your essay is saved.
        </Banner>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-bold tabular-nums">
              {result.total}
              <span className="text-xl text-muted-foreground"> of {result.maxTotal}</span>
            </p>
            <Pill tone="neutral">Practice estimate</Pill>
          </div>
          <p className="-mt-4 text-sm text-muted-foreground">A practice estimate from the AP rubric, not a teacher score or an exam score.</p>

          <ol className="flex flex-col gap-4">
            {result.rows.map((row) => (
              <li key={row.key}>
                <Card>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold">{row.label}</h2>
                      <Outcome row={row} />
                    </div>
                    {row.failed ? (
                      <p className="text-base text-muted-foreground">This part could not be scored. Use Score again later, or ask your teacher.</p>
                    ) : (
                      <>
                        {row.feedback && <p className="text-base">{row.feedback}</p>}
                        {row.quotes.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">From your essay</p>
                            {row.quotes.map((q, i) => (
                              <blockquote key={i} className="essay-text border-l-4 border-border pl-3">
                                “{q}”
                              </blockquote>
                            ))}
                          </div>
                        )}
                        {row.unsure && (
                          <p className="text-sm font-bold text-warning-text">We are not sure about this one. Ask your teacher to check it.</p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </>
      )}

      {result && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Your essay</SectionTitle>
          <Card>
            <CardContent>
              <div className="essay-text whitespace-pre-wrap">{result.essayText || "No text was submitted."}</div>
            </CardContent>
          </Card>
        </section>
      )}

      {!scoring && (
        <UpNext
          title="Write another essay"
          reason="Practice the parts that did not earn points yet."
          action={
            <Button asChild>
              <Link href="/practice">Back to practice</Link>
            </Button>
          }
        />
      )}
    </PageBody>
  );
}
