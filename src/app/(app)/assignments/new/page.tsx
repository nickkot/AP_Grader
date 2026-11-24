import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssignmentForm } from "@/app/(app)/assignments/new/assignment-form";
import { PageBody, PageHeader } from "@/components/page-header";
import { getClassForTeacher } from "@/lib/data";
import { COURSES, ESSAY_TYPES } from "@/lib/rubrics";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Create assignment" };

export default async function NewAssignmentPage(props: PageProps<"/assignments/new">) {
  const teacher = await requireTeacher();
  const { classId } = await props.searchParams;
  if (typeof classId !== "string") notFound();
  const cls = await getClassForTeacher(classId, teacher.id);
  const types = COURSES[cls.course].essayTypes.map((t) => ({ value: t, ...ESSAY_TYPES[t] }));

  return (
    <PageBody wide={false}>
      <PageHeader
        title="Create assignment"
        description={`${cls.name} · ${COURSES[cls.course].label}`}
        back={{ href: `/classes/${cls.id}`, label: cls.name }}
      />
      <AssignmentForm classId={cls.id} essayTypes={types} />
    </PageBody>
  );
}
