import type { Metadata } from "next";

import { NewClassForm } from "@/app/(app)/classes/new/new-class-form";
import { PageBody, PageHeader } from "@/components/page-header";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Create class" };

export default async function NewClassPage() {
  await requireTeacher();
  return (
    <PageBody wide={false}>
      <PageHeader title="Create class" back={{ href: "/classes", label: "Classes" }} />
      <NewClassForm />
    </PageBody>
  );
}
