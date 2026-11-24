import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import QRCode from "qrcode";

import { db } from "@/lib/db";
import { assignments, classes, phoneLinks } from "@/lib/db/schema";
import { env } from "@/lib/env";

/**
 * Phone links: the teacher's computer shows a QR code, their phone opens it and
 * takes page photos without signing in. A link can only add pages to one
 * assignment, and it stops working after PHONE_LINK_HOURS.
 */

export const PHONE_LINK_HOURS = 2;
/** Enough for several class sets. Stops a leaked link from filling the matching queue. */
export const MAX_PAGES_PER_PHONE_LINK = 400;

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export function hashPhoneToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPhoneLink(assignmentId: string, teacherId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + PHONE_LINK_HOURS * 60 * 60 * 1000);
  await db.insert(phoneLinks).values({ tokenHash: hashPhoneToken(token), assignmentId, teacherId, expiresAt });
  return { token, expiresAt };
}

/** The link and what the phone screen may show about it, or null if the token is wrong or expired. */
export async function findPhoneLink(token: string, now = new Date()) {
  if (!TOKEN_FORMAT.test(token)) return null;
  const [row] = await db
    .select({
      id: phoneLinks.id,
      teacherId: phoneLinks.teacherId,
      expiresAt: phoneLinks.expiresAt,
      assignmentId: assignments.id,
      assignmentTitle: assignments.title,
      className: classes.name,
    })
    .from(phoneLinks)
    .innerJoin(assignments, and(eq(assignments.id, phoneLinks.assignmentId), eq(assignments.teacherId, phoneLinks.teacherId)))
    .innerJoin(classes, eq(classes.id, assignments.classId))
    .where(and(eq(phoneLinks.tokenHash, hashPhoneToken(token)), gt(phoneLinks.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export type PhoneLink = NonNullable<Awaited<ReturnType<typeof findPhoneLink>>>;

export function phoneLinkUrl(token: string) {
  return new URL(`/phone/${token}`, env().APP_URL).toString();
}

/** A phone cannot open localhost. True when the link points somewhere a phone could reach. */
export function reachableFromPhone(url: string) {
  return !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
}

/** The QR code as an SVG data URL. Always black on white, whatever the theme, so phone cameras read it. */
export async function phoneLinkQrDataUrl(url: string) {
  const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
