"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit, isUuid } from "@/lib/data";
import { retryScoring, saveDraft, startAttempt, submitAttempt } from "@/lib/practice/attempts";
import { requireStudent } from "@/lib/session";

const essayPath = (id: string) => `/practice/essays/${id}`;

export async function startPractice(form: FormData) {
  const student = await requireStudent();
  const promptKey = z.string().max(80).parse(form.get("promptKey"));
  const mode = form.get("mode") === "untimed" ? "untimed" : "timed";
  const result = await startAttempt(student.id, promptKey, mode);
  if ("error" in result) redirect("/practice/library");
  await audit(student.id, "practice.start", "practice_attempt", result.attempt.id, { promptKey, mode });
  redirect(essayPath(result.attempt.id));
}

export async function saveDraftAction(attemptId: string, text: string, seq: number) {
  const student = await requireStudent();
  if (!isUuid(attemptId) || typeof text !== "string" || !Number.isInteger(seq)) return { error: "Could not save." } as const;
  return saveDraft(student.id, attemptId, text, seq);
}

export async function submitPracticeAction(attemptId: string, text: string, auto: boolean) {
  const student = await requireStudent();
  if (!isUuid(attemptId) || typeof text !== "string") return { error: "Could not submit." } as const;
  const result = await submitAttempt(student.id, attemptId, text, auto === true);
  if ("ok" in result) {
    await audit(student.id, "practice.submit", "practice_attempt", attemptId, { auto: auto === true });
    revalidatePath(essayPath(attemptId));
  }
  return result;
}

export async function retryPracticeScoring(attemptId: string) {
  const student = await requireStudent();
  if (!isUuid(attemptId)) return;
  await retryScoring(student.id, attemptId);
  revalidatePath(essayPath(attemptId));
}
