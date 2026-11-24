import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageBody, PageHeader, SectionTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { startPractice } from "@/lib/actions/practice";
import { courseLabel, essayTypeLabel, timingLabel } from "@/lib/practice/labels";
import { practicePrompt } from "@/lib/practice/prompts";
import { requireStudent } from "@/lib/session";

export const metadata: Metadata = { title: "Prompt" };

function StartButton({ promptKey, mode, children, variant }: { promptKey: string; mode: "timed" | "untimed"; children: React.ReactNode; variant?: "outline" }) {
  return (
    <form action={startPractice}>
      <input type="hidden" name="promptKey" value={promptKey} />
      <input type="hidden" name="mode" value={mode} />
      <Button type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}

export default async function PromptPage(props: PageProps<"/practice/prompts/[key]">) {
  await requireStudent();
  const { key } = await props.params;
  const prompt = practicePrompt(key);
  if (!prompt) notFound();

  return (
    <PageBody wide={false}>
      <PageHeader
        back={{ href: "/practice/library", label: "Library" }}
        title={prompt.title}
        description={`${courseLabel(prompt)} · ${essayTypeLabel(prompt)}`}
        actions={
          <>
            <StartButton promptKey={prompt.key} mode="timed">
              Start timed essay
            </StartButton>
            <StartButton promptKey={prompt.key} mode="untimed" variant="outline">
              Write without a timer
            </StartButton>
          </>
        }
      />
      <p className="text-sm text-muted-foreground">
        Timed: {timingLabel(prompt)}. The essay is submitted when time runs out. Spell check is off, as on the exam.
      </p>

      <Card>
        <CardContent>
          <p className="essay-text">{prompt.promptText}</p>
        </CardContent>
      </Card>

      {prompt.sources.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle>Documents</SectionTitle>
          {prompt.sources.map((s) => (
            <Card key={s.number}>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm font-bold">
                  Document {s.number}. <span className="font-normal text-muted-foreground">{s.citation}</span>
                </p>
                <p className="essay-text">{s.text}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </PageBody>
  );
}
