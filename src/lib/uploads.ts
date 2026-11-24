import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { pages, uploadBatches } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs";
import { objectExists, presignUpload } from "@/lib/storage";

/**
 * Photo upload steps shared by the teacher's upload screen and the phone link.
 * Callers check who is uploading first; these functions only check that the
 * batch, key and page belong to the assignment they were given.
 */

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

export async function createPhotoBatch(assignmentId: string, uploadedBy: string, phoneLinkId: string | null = null) {
  const [batch] = await db
    .insert(uploadBatches)
    .values({ assignmentId, uploadedBy, kind: "photos", status: "done", phoneLinkId })
    .returning({ id: uploadBatches.id });
  return { batchId: batch.id };
}

/** Signed URL for one photo. The browser uploads straight to storage, then registers the page. */
export async function presignPagePhoto(assignmentId: string, contentType: string) {
  // The browser converts every photo to JPEG before upload (see the capture screen).
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return { error: "Upload JPG or PNG photos." } as const;
  }
  const pageId = randomUUID();
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `assignments/${assignmentId}/pages/${pageId}.${ext}`;
  return { pageId, key, url: await presignUpload(key, contentType) } as const;
}

export const PagePhoto = z.object({
  batchId: z.string().uuid(),
  pageId: z.string().uuid(),
  key: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
});
export type PagePhoto = z.infer<typeof PagePhoto>;

/** The batch, if it belongs to this assignment (and to this phone link, when one is given). */
export async function findBatch(assignmentId: string, batchId: string, phoneLinkId?: string) {
  return db.query.uploadBatches.findFirst({
    where: and(
      eq(uploadBatches.id, batchId),
      eq(uploadBatches.assignmentId, assignmentId),
      phoneLinkId ? eq(uploadBatches.phoneLinkId, phoneLinkId) : undefined,
    ),
  });
}

/** Record an uploaded photo as a page and queue it for reading. */
export async function registerPagePhoto(assignmentId: string, uploadedBy: string, input: PagePhoto, phoneLinkId?: string) {
  const data = PagePhoto.parse(input);
  if (!data.key.startsWith(`assignments/${assignmentId}/pages/${data.pageId}.`)) throw new Error("Invalid upload.");
  if (!(await findBatch(assignmentId, data.batchId, phoneLinkId))) throw new Error("Invalid upload.");
  if (!(await objectExists(data.key))) return { error: "Upload did not finish. Try that photo again." } as const;

  await db
    .insert(pages)
    .values({
      id: data.pageId,
      assignmentId,
      uploadBatchId: data.batchId,
      originalKey: data.key,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      sha256: "pending",
      uploadedBy,
      status: "uploaded",
    })
    .onConflictDoNothing();
  await enqueue({ name: "page/process", data: { pageId: data.pageId } });
  return { ok: true } as const;
}

/** Pages uploaded so far through every batch of one phone link. */
export async function pagesForPhoneLink(phoneLinkId: string) {
  const batches = db.select({ id: uploadBatches.id }).from(uploadBatches).where(eq(uploadBatches.phoneLinkId, phoneLinkId));
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(pages)
    .where(inArray(pages.uploadBatchId, batches));
  return row?.n ?? 0;
}

/** Progress for one batch: how many pages are read, matched or need attention. Counts only. */
export async function progressForBatch(assignmentId: string, batchId: string) {
  const batch = await findBatch(assignmentId, batchId);
  const rows = batch ? await db.select({ status: pages.status }).from(pages).where(eq(pages.uploadBatchId, batch.id)) : [];
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

export type BatchProgress = Awaited<ReturnType<typeof progressForBatch>>;
