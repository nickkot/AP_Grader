import type { Metadata } from "next";

import { Capture } from "@/app/(app)/assignments/[id]/upload/capture";
import { PageBody, PageHeader } from "@/components/page-header";
import { getAssignmentForTeacher, getClassForTeacher } from "@/lib/data";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Upload photos" };

export default async function UploadPage(props: PageProps<"/assignments/[id]/upload">) {
  const teacher = await requireTeacher();
  const { id } = await props.params;
  const assignment = await getAssignmentForTeacher(id, teacher.id);
  const cls = await getClassForTeacher(assignment.classId, teacher.id);

  return (
    <PageBody wide={false} className="gap-4">
      <PageHeader
        back={{ href: `/assignments/${assignment.id}`, label: assignment.title }}
        title="Upload photos"
        description={`${cls.name}. Pages are matched to students by their QR codes, in any order.`}
      />
      <Capture assignmentId={assignment.id} />
    </PageBody>
  );
}
