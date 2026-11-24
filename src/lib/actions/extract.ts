"use server";

import { requireTeacher } from "@/lib/session";

const MAX_BYTES = 10 * 1024 * 1024;

/** Pull plain text out of an uploaded .docx, .pdf or .txt essay so the teacher can check it before scoring. */
export async function extractEssayText(form: FormData): Promise<{ text?: string; error?: string }> {
  await requireTeacher();
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Choose a file." };
  if (file.size > MAX_BYTES) return { error: "This file is over 10 MB." };
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    if (name.endsWith(".txt")) return { text: buf.toString("utf8") };
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      return { text: result.value.trim() };
    }
    if (name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const doc = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(doc, { mergePages: true });
      if (!text.trim()) return { error: "This PDF has no text. If it is a scan, upload it on the photos page instead." };
      return { text: text.trim() };
    }
  } catch {
    return { error: "This file could not be read. Save it again as .docx, .pdf or .txt." };
  }
  return { error: "Upload a .docx, .pdf or .txt file." };
}
