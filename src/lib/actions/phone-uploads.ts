"use server";

import { audit, isUuid } from "@/lib/data";
import { findPhoneLink, MAX_PAGES_PER_PHONE_LINK } from "@/lib/phone-links";
import { createPhotoBatch, findBatch, pagesForPhoneLink, presignPagePhoto, progressForBatch, registerPagePhoto, type PagePhoto } from "@/lib/uploads";

/**
 * Upload actions for the phone link. The token in the link is the only credential:
 * every action looks it up again, and it can only add pages to its own assignment.
 */

const EXPIRED = "This link has expired. Show a new code on your computer.";

export async function startPhoneBatch(token: string) {
  const link = await findPhoneLink(String(token));
  if (!link) return { error: EXPIRED } as const;
  const batch = await createPhotoBatch(link.assignmentId, link.teacherId, link.id);
  await audit(link.teacherId, "phone_link.upload", "assignment", link.assignmentId, { batchId: batch.batchId });
  return batch;
}

export async function presignPhonePhoto(token: string, contentType: string) {
  const link = await findPhoneLink(String(token));
  if (!link) return { error: EXPIRED } as const;
  if ((await pagesForPhoneLink(link.id)) >= MAX_PAGES_PER_PHONE_LINK) {
    return { error: `This link has taken ${MAX_PAGES_PER_PHONE_LINK} pages. Show a new code on your computer.` } as const;
  }
  return presignPagePhoto(link.assignmentId, String(contentType));
}

export async function registerPhonePhoto(token: string, input: PagePhoto) {
  const link = await findPhoneLink(String(token));
  if (!link) return { error: EXPIRED } as const;
  return registerPagePhoto(link.assignmentId, link.teacherId, input, link.id);
}

export async function phoneBatchProgress(token: string, batchId: string) {
  const link = await findPhoneLink(String(token));
  if (!link) return { error: EXPIRED } as const;
  if (!isUuid(String(batchId)) || !(await findBatch(link.assignmentId, batchId, link.id))) return { error: "Upload not found." } as const;
  return progressForBatch(link.assignmentId, batchId);
}
