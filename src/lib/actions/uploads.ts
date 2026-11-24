"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { pages, students, uploadBatches } from "@/lib/db/schema";
import { audit, getAssignmentForTeacher, isUuid } from "@/lib/data";
import { enqueue } from "@/lib/jobs";
import { createPhoneLink, phoneLinkQrDataUrl, phoneLinkUrl, PHONE_LINK_HOURS, reachableFromPhone } from "@/lib/phone-links";
import { attachPage } from "@/lib/pipeline/run";
import { objectExists, presignUpload } from "@/lib/storage";
import { createPhotoBatch, presignPagePhoto, progressForBatch, registerPagePhoto, type PagePhoto } from "@/lib/uploads";
import { requireTeacher } from "@/lib/session";

const MAX_PDF_BYTES = 500 * 1024 * 1024;

export async function startUploadBatch(assignmentId: string, kind: "photos" | "pdf") {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  if (kind === "photos") return createPhotoBatch(assignment.id, teacher.id);
  const [batch] = await db
    .insert(uploadBatches)
    .values({ assignmentId: assignment.id, uploadedBy: teacher.id, kind, status: "processing" })
    .returning();
  return { batchId: batch.id };
}

/** Signed URL for one photo. The browser uploads straight to storage, then calls registerPhoto. */
export async function presignPhoto(assignmentId: string, contentType: string) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  return presignPagePhoto(assignment.id, contentType);
}

export async function registerPhoto(input: PagePhoto & { assignmentId: string }) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(z.string().uuid().parse(input.assignmentId), teacher.id);
  return registerPagePhoto(assignment.id, teacher.id, input);
}

/**
 * A QR code the teacher scans with their phone to take page photos there.
 * The link only uploads pages to this assignment and stops working after PHONE_LINK_HOURS.
 */
export async function createPhoneUploadLink(assignmentId: string) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  const { token, expiresAt } = await createPhoneLink(assignment.id, teacher.id);
  await audit(teacher.id, "phone_link.create", "assignment", assignment.id, { expiresAt: expiresAt.toISOString() });
  const url = phoneLinkUrl(token);
  return { url, qrSrc: await phoneLinkQrDataUrl(url), hours: PHONE_LINK_HOURS, reachable: reachableFromPhone(url) };
}

export async function presignPdf(assignmentId: string, batchId: string, sizeBytes: number) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  if (sizeBytes > MAX_PDF_BYTES) return { error: "This PDF is over 500 MB. Split it into smaller scans." } as const;
  if (!isUuid(batchId)) throw new Error("Invalid batch.");
  const key = `assignments/${assignment.id}/batches/${batchId}.pdf`;
  await db.update(uploadBatches).set({ pdfKey: key }).where(and(eq(uploadBatches.id, batchId), eq(uploadBatches.assignmentId, assignment.id)));
  return { key, url: await presignUpload(key, "application/pdf") } as const;
}

export async function finishPdf(assignmentId: string, batchId: string) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  const batch = await db.query.uploadBatches.findFirst({
    where: and(eq(uploadBatches.id, batchId), eq(uploadBatches.assignmentId, assignment.id)),
  });
  if (!batch?.pdfKey || !(await objectExists(batch.pdfKey))) return { error: "Upload did not finish. Try the PDF again." } as const;
  await audit(teacher.id, "upload.pdf", "assignment", assignment.id, { batchId });
  await enqueue({ name: "batch/split-pdf", data: { batchId } });
  return { ok: true } as const;
}

/** Progress for an upload session: how many pages are read, matched or need attention. */
export async function batchProgress(assignmentId: string, batchId: string) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  if (!isUuid(batchId)) throw new Error("Invalid batch.");
  return progressForBatch(assignment.id, batchId);
}

const MatchPage = z.object({
  pageId: z.string().uuid(),
  studentId: z.string().uuid(),
  pageNumber: z.coerce.number().int().min(1).max(20),
});

export async function matchPage(assignmentId: string, form: FormData) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  const data = MatchPage.parse({ pageId: form.get("pageId"), studentId: form.get("studentId"), pageNumber: form.get("pageNumber") });
  const page = await db.query.pages.findFirst({ where: and(eq(pages.id, data.pageId), eq(pages.assignmentId, assignment.id)) });
  const student = await db.query.students.findFirst({
    where: and(eq(students.id, data.studentId), eq(students.classId, assignment.classId)),
  });
  if (!page || !student) throw new Error("Page or student not found.");
  await attachPage(page.id, student.id, data.pageNumber, "manual");
  await audit(teacher.id, "page.match", "page", page.id, { studentId: student.id, pageNumber: data.pageNumber });
  revalidatePath(`/assignments/${assignment.id}/match`);
  revalidatePath(`/assignments/${assignment.id}`);
}

export async function discardPage(assignmentId: string, pageId: string) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  await db
    .update(pages)
    .set({ status: "failed", submissionId: null, error: "Discarded by the teacher." })
    .where(and(eq(pages.id, pageId), eq(pages.assignmentId, assignment.id)));
  await audit(teacher.id, "page.discard", "page", pageId);
  revalidatePath(`/assignments/${assignment.id}/match`);
}

export async function retryPage(assignmentId: string, pageId: string) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  const page = await db.query.pages.findFirst({ where: and(eq(pages.id, pageId), eq(pages.assignmentId, assignment.id)) });
  if (!page) return;
  await db.update(pages).set({ status: "uploaded", error: null }).where(eq(pages.id, page.id));
  await enqueue({ name: "page/process", data: { pageId: page.id } });
  revalidatePath(`/assignments/${assignment.id}`);
}
