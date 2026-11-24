"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { saveDraftAction, submitPracticeAction } from "@/lib/actions/practice";
import { cn } from "@/lib/utils";

type Source = { number: number; citation: string; text: string };

export type WritingRoomProps = {
  attemptId: string;
  mode: "timed" | "untimed";
  readingEndsAt: string | null;
  deadlineAt: string | null;
  serverNow: string;
  draftText: string;
  draftSeq: number;
  prompt: { title: string; promptText: string; sources: Source[]; typeLabel: string };
};

const AUTOSAVE_MS = 5000;

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function words(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function PromptPanel({ prompt }: { prompt: WritingRoomProps["prompt"] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="essay-text">{prompt.promptText}</p>
      {prompt.sources.map((s) => (
        <div key={s.number} className="flex flex-col gap-1 border-t border-border pt-4">
          <p className="text-sm font-bold">
            Document {s.number}. <span className="font-normal text-muted-foreground">{s.citation}</span>
          </p>
          <p className="essay-text">{s.text}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * The writing room: prompt beside the editor (tabs on phones), autosave every 5 seconds,
 * and for timed essays a countdown that submits the essay when time runs out.
 */
export function WritingRoom(props: WritingRoomProps) {
  const { attemptId, mode, prompt } = props;
  const router = useRouter();
  const timed = mode === "timed";
  // Count down from the server's clock, not the device's, so a wrong device time cannot add minutes.
  const [offset] = useState(() => new Date(props.serverNow).getTime() - Date.now());
  const deadline = props.deadlineAt ? new Date(props.deadlineAt).getTime() : null;
  const readingEnds = props.readingEndsAt ? new Date(props.readingEndsAt).getTime() : null;

  const [text, setText] = useState(props.draftText);
  const [now, setNow] = useState(() => Date.now() + offset);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seqRef = useRef(props.draftSeq);
  const savedTextRef = useRef(props.draftText);
  const textRef = useRef(text);
  const submittedRef = useRef(false);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const save = useCallback(async () => {
    const current = textRef.current;
    if (current === savedTextRef.current || submittedRef.current) return;
    seqRef.current += 1;
    setSaveState("saving");
    try {
      const result = await saveDraftAction(attemptId, current, seqRef.current);
      if ("error" in result) throw new Error(result.error);
      savedTextRef.current = current;
      setSaveState(textRef.current === current ? "saved" : "saving");
    } catch {
      setSaveState("error");
    }
  }, [attemptId]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setError(null);
      const result = await submitPracticeAction(attemptId, textRef.current, auto);
      if ("error" in result) {
        submittedRef.current = false;
        setSubmitting(false);
        setConfirmOpen(false);
        setError(result.error ?? "Could not submit. Try again.");
        return;
      }
      router.refresh();
    },
    [attemptId, router],
  );

  // Autosave, and save when the tab is hidden.
  useEffect(() => {
    const id = setInterval(() => void save(), AUTOSAVE_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [save]);

  // Warn before leaving with unsaved words.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current && textRef.current !== savedTextRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  // Countdown, and submit when time runs out.
  useEffect(() => {
    if (!timed || deadline === null) return;
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [timed, deadline, offset]);
  const remaining = deadline === null ? null : deadline - now;
  useEffect(() => {
    if (remaining !== null && remaining <= 0) void submit(true);
  }, [remaining, submit]);

  const reading = readingEnds !== null && now < readingEnds;
  const lowTime = remaining !== null && remaining <= 5 * 60_000;

  const editor = (
    <div className="flex flex-col gap-2">
      <label htmlFor="essay" className="sr-only">
        Your essay
      </label>
      <textarea
        id="essay"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaveState("saving");
        }}
        spellCheck={!timed}
        autoCorrect={timed ? "off" : "on"}
        autoCapitalize="sentences"
        disabled={submitting}
        placeholder={reading ? "Read the documents first. You can take notes here." : "Start writing."}
        className="essay-text min-h-[60vh] w-full resize-y rounded-card border border-input bg-surface p-4 shadow-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-6"
      />
      <p className="flex items-center justify-between text-sm text-muted-foreground" aria-live="polite">
        <span>{words(text)} words</span>
        <span>{saveState === "saving" ? "Saving" : saveState === "error" ? "Not saved. Check your connection." : "Saved"}</span>
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-8 sm:py-6">
      <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-canvas px-4 py-3 sm:-mx-8 sm:px-8">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h1 className="truncate text-lg font-bold" title={prompt.title}>
            {prompt.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {prompt.typeLabel} · {timed ? "Timed" : "Untimed"}
          </p>
        </div>
        {timed && remaining !== null && (
          <p
            className={cn("flex items-baseline gap-2 tabular-nums sm:block sm:text-right", lowTime ? "text-warning-text" : "text-foreground")}
            role="timer"
            aria-label={reading ? "Reading period time left" : "Writing time left"}
          >
            <span className="text-xs font-bold tracking-wide uppercase sm:block">{reading ? "Reading period" : "Time left"}</span>
            <span className="text-xl font-bold sm:text-2xl">{clock(reading && readingEnds !== null ? readingEnds - now : remaining)}</span>
          </p>
        )}
        <Button onClick={() => setConfirmOpen(true)} disabled={submitting} className="ml-auto sm:ml-0">
          Submit essay
        </Button>
      </div>

      {error && <FieldError>{error}</FieldError>}

      {/* One layout: tabs on phones and tablets, prompt beside the editor on a laptop. */}
      <Tabs defaultValue="prompt" className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
        <TabsList className="lg:hidden">
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="essay">Your essay</TabsTrigger>
        </TabsList>
        <TabsContent
          value="prompt"
          forceMount
          className="data-[state=inactive]:hidden lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-6 lg:shadow-low lg:data-[state=inactive]:block"
        >
          <PromptPanel prompt={prompt} />
        </TabsContent>
        <TabsContent value="essay" forceMount className="data-[state=inactive]:hidden lg:data-[state=inactive]:block">
          {editor}
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your essay?</DialogTitle>
            <DialogDescription>
              You cannot change it after you submit. Scores are ready in about a minute. {words(text)} words.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Keep writing
            </Button>
            <Button onClick={() => void submit(false)} disabled={submitting}>
              {submitting ? "Submitting" : "Submit essay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
