"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { pages, students, uploadBatches } from "@/lib/db/schema";
import { audit, getAssignmentForTeacher, isUuid } from "@/lib/data";
import { enqueue } from "@/lib/jobs";
import { attachPage } from "@/lib/pipeline/run";
import { objectExists, presignUpload } from "@/lib/storage";
import { requireTeacher } from "@/lib/session";

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const MAX_PDF_BYTES = 500 * 1024 * 1024;

export async function startUploadBatch(assignmentId: string, kind: "photos" | "pdf") {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  const [batch] = await db
    .insert(uploadBatches)
    .values({ assignmentId: assignment.id, uploadedBy: teacher.id, kind, status: kind === "pdf" ? "processing" : "done" })
    .returning();
  return { batchId: batch.id };
}

/** Signed URL for one photo. The browser uploads straight to storage, then calls registerPhoto. */
export async function presignPhoto(assignmentId: string, contentType: string) {
  const teacher = await requireTeacher();
  const assignment = await getAssignmentForTeacher(assignmentId, teacher.id);
  // The browser converts every photo to JPEG before upload (see the capture screen).
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return { error: "Upload JPG or PNG photos." } as const;
  }
  const pageId = randomUUID();
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `assignments/${assignment.id}/pages/${pageId}.${ext}`;
  return { pageId, key, url: await presignUpload(key, contentType) } as const;
}

const RegisterPhoto = z.object({
  assignmentId: z.string().uuid(),
  batchId: z.string().uuid(),
  pageId: z.string().uuid(),
  key: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
});

export async function registerPhoto(input: z.infer<typeof RegisterPhoto>) {
  const teacher = await requireTeacher();
  const data = RegisterPhoto.parse(input);
  const assignment = await getAssignmentForTeacher(data.assignmentId, teacher.id);
  if (!data.key.startsWith(`assignments/${assignment.id}/pages/${data.pageId}.`)) throw new Error("Invalid upload.");
  if (!(await objectExists(data.key))) return { error: "Upload did not finish. Try that photo again." } as const;

  await db.insert(pages).values({
    id: data.pageId,
    assignmentId: assignment.id,
    uploadBatchId: data.batchId,
    originalKey: data.key,
    contentType: data.contentType,
    sizeBytes: data.sizeBytes,
    sha256: "pending",
    uploadedBy: teacher.id,
    status: "uploaded",
  }).onConflictDoNothing();
  await enqueue({ name: "page/process", data: { pageId: data.pageId } });
  return { ok: true } as const;
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
  await getAssignmentForTeacher(assignmentId, teacher.id);
  const batch = await db.query.uploadBatches.findFirst({ where: eq(uploadBatches.id, batchId) });
  const rows = await db.select({ status: pages.status }).from(pages).where(eq(pages.uploadBatchId, batchId));
  const count = (s: string[]) => rows.filter((r) => s.includes(r.status)).length;
  return {
    batchStatus: batch?.status ?? "done",
    batchError: batch?.error ?? null,
    total: rows.length,
    working: count(["uploaded", "processing", "transcribing"]),
    done: count(["transcribed"]),
    unmatched: count(["unmatched"]),
    failed: count(["failed"]),
  };
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
