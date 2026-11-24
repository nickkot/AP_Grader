"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { classes, students } from "@/lib/db/schema";
import { audit, getClassForTeacher, parseRoster } from "@/lib/data";
import { requireTeacher } from "@/lib/session";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const CreateClass = z.object({
  course: z.enum(["APUSH", "AP_LANG"]),
  name: z.string().trim().min(1, "Enter a class name, like Period 3.").max(60),
  roster: z.string().max(20_000).optional().default(""),
});

export async function createClass(_prev: FormState, form: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const parsed = CreateClass.safeParse({
    course: form.get("course"),
    name: form.get("name"),
    roster: form.get("roster") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const roster = parseRoster(parsed.data.roster);
  if (roster.length > 200) return { fieldErrors: { roster: "A class can have up to 200 students." } };

  const [cls] = await db
    .insert(classes)
    .values({ teacherId: teacher.id, course: parsed.data.course, name: parsed.data.name })
    .returning();
  if (roster.length) {
    await db.insert(students).values(roster.map((s) => ({ ...s, classId: cls.id, teacherId: teacher.id })));
  }
  await audit(teacher.id, "class.create", "class", cls.id, { students: roster.length });
  redirect(`/classes/${cls.id}`);
}

export async function addStudents(classId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const cls = await getClassForTeacher(classId, teacher.id);
  const roster = parseRoster(String(form.get("roster") ?? ""));
  if (roster.length === 0) return { fieldErrors: { roster: "Enter at least one student, one per line." } };
  await db.insert(students).values(roster.map((s) => ({ ...s, classId: cls.id, teacherId: teacher.id })));
  await audit(teacher.id, "class.add_students", "class", cls.id, { students: roster.length });
  revalidatePath(`/classes/${cls.id}`);
  return {};
}
