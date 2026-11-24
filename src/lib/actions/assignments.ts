"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { assignments } from "@/lib/db/schema";
import { audit, getClassForTeacher } from "@/lib/data";
import { ESSAY_TYPES, rubricForEssayType, type EssayType } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";
import type { FormState } from "@/lib/actions/classes";

const Source = z.object({
  number: z.number().int().min(1).max(20),
  citation: z.string().trim().min(1, "Add a citation for every document.").max(500),
  text: z.string().trim().min(1, "Add the text of every document.").max(8000),
});

const CreateAssignment = z.object({
  classId: z.string().uuid(),
  essayType: z.enum(["APUSH_DBQ", "LANG_ARG"]),
  title: z.string().trim().min(1, "Enter a title.").max(120),
  promptText: z.string().trim().min(10, "Enter the prompt students will answer.").max(4000),
  timeLimitMinutes: z.coerce.number().int().min(5, "Time limit must be at least 5 minutes.").max(240),
  answerPagesPerStudent: z.coerce.number().int().min(1).max(8),
  sources: z.array(Source).max(20),
});

export async function createAssignment(_prev: FormState, form: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  let sources: unknown = [];
  try {
    sources = JSON.parse(String(form.get("sources") ?? "[]"));
  } catch {
    return { error: "The documents could not be read. Try again." };
  }
  const parsed = CreateAssignment.safeParse({
    classId: form.get("classId"),
    essayType: form.get("essayType"),
    title: form.get("title"),
    promptText: form.get("promptText"),
    timeLimitMinutes: form.get("timeLimitMinutes"),
    answerPagesPerStudent: form.get("answerPagesPerStudent"),
    sources,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  const data = parsed.data;
  const cls = await getClassForTeacher(data.classId, teacher.id);
  const type = ESSAY_TYPES[data.essayType as EssayType];
  if (type.course !== cls.course) return { fieldErrors: { essayType: "Pick an essay type for this course." } };
  if (type.usesSources && data.sources.length === 0) {
    return { fieldErrors: { sources: "Add the documents students will use." } };
  }

  const rubric = rubricForEssayType(data.essayType);
  const [row] = await db
    .insert(assignments)
    .values({
      teacherId: teacher.id,
      classId: cls.id,
      essayType: data.essayType,
      title: data.title,
      promptText: data.promptText,
      sources: type.usesSources ? data.sources.map((s, i) => ({ ...s, number: i + 1 })) : [],
      timeLimitMinutes: data.timeLimitMinutes,
      readingMinutes: type.defaultReadingMinutes,
      answerPagesPerStudent: data.answerPagesPerStudent,
      rubricKey: rubric.key,
      rubricVersion: rubric.version,
    })
    .returning();
  await audit(teacher.id, "assignment.create", "assignment", row.id);
  redirect(`/assignments/${row.id}`);
}
