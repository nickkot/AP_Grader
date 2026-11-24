"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { classes, students } from "@/lib/db/schema";
import { audit, getClassForTeacher, parseRoster } from "@/lib/data";
import { nextStudentNumber, numberedStudents, numberingOrder, replaceNames } from "@/lib/rosters";
import { requireTeacher } from "@/lib/session";

const MAX_STUDENTS = 200;

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const CreateClass = z.object({
  course: z.enum(["APUSH", "AP_LANG"]),
  name: z.string().trim().min(1, "Enter a class name, like Period 3.").max(60),
  rosterKind: z.enum(["names", "numbers"]).default("names"),
  roster: z.string().max(20_000).optional().default(""),
  studentCount: z.coerce
    .number({ error: "Enter how many students are in the class." })
    .int("Enter a whole number.")
    .min(1, "Enter at least 1 student.")
    .max(MAX_STUDENTS, `A class can have up to ${MAX_STUDENTS} students.`)
    .optional(),
});

export async function createClass(_prev: FormState, form: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const rosterKind = form.get("rosterKind") === "numbers" ? "numbers" : "names";
  const parsed = CreateClass.safeParse({
    course: form.get("course"),
    name: form.get("name"),
    rosterKind,
    roster: form.get("roster") ?? "",
    studentCount: rosterKind === "numbers" ? form.get("studentCount") : undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const roster = rosterKind === "names" ? parseRoster(parsed.data.roster) : [];
  if (roster.length > MAX_STUDENTS) return { fieldErrors: { roster: `A class can have up to ${MAX_STUDENTS} students.` } };
  const count = rosterKind === "numbers" ? (parsed.data.studentCount ?? 0) : roster.length;

  const [cls] = await db
    .insert(classes)
    .values({ teacherId: teacher.id, course: parsed.data.course, name: parsed.data.name, rosterKind })
    .returning();
  if (rosterKind === "numbers") {
    await db.insert(students).values(numberedStudents(cls.id, teacher.id, 1, count));
  } else if (roster.length) {
    await db.insert(students).values(roster.map((s) => ({ ...s, classId: cls.id, teacherId: teacher.id })));
  }
  await audit(teacher.id, "class.create", "class", cls.id, { students: count, rosterKind });
  redirect(`/classes/${cls.id}`);
}

export async function addStudents(classId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const cls = await getClassForTeacher(classId, teacher.id);

  if (cls.rosterKind === "numbers") {
    const count = z.coerce.number().int().min(1).max(MAX_STUDENTS).safeParse(form.get("count"));
    if (!count.success) return { fieldErrors: { count: `Enter a number from 1 to ${MAX_STUDENTS}.` } };
    await db.insert(students).values(numberedStudents(cls.id, teacher.id, await nextStudentNumber(cls.id), count.data));
    await audit(teacher.id, "class.add_students", "class", cls.id, { students: count.data });
    revalidatePath(`/classes/${cls.id}`);
    return {};
  }

  const roster = parseRoster(String(form.get("roster") ?? ""));
  if (roster.length === 0) return { fieldErrors: { roster: "Enter at least one student, one per line." } };
  await db.insert(students).values(roster.map((s) => ({ ...s, classId: cls.id, teacherId: teacher.id })));
  await audit(teacher.id, "class.add_students", "class", cls.id, { students: roster.length });
  revalidatePath(`/classes/${cls.id}`);
  return {};
}

/**
 * The key a teacher downloads before names are replaced: which number each student gets.
 * The app keeps no copy once the names are replaced.
 */
export async function numberKey(classId: string) {
  const teacher = await requireTeacher();
  const cls = await getClassForTeacher(classId, teacher.id);
  if (cls.rosterKind === "numbers") return { error: "This class already lists students by number." } as const;
  const order = await numberingOrder(cls.id);
  return {
    rows: order.map((s) => ({ id: s.id, number: s.newNumber, firstName: s.firstName, lastName: s.lastName, removed: !!s.removedAt })),
  } as const;
}

/**
 * Replace every name in the class with a number, permanently. `orderedIds` is the order
 * in the key the teacher downloaded; if the roster changed since, nothing is replaced.
 */
export async function replaceNamesWithNumbers(classId: string, orderedIds: string[]) {
  const teacher = await requireTeacher();
  const cls = await getClassForTeacher(classId, teacher.id);
  if (cls.rosterKind === "numbers") return { error: "This class already lists students by number." } as const;
  const result = await replaceNames(cls.id, z.array(z.string().uuid()).max(5000).parse(orderedIds));
  if ("error" in result) return result;
  await audit(teacher.id, "class.replace_names", "class", cls.id, { students: result.students });
  revalidatePath(`/classes/${cls.id}`);
  return { ok: true } as const;
}
