import "server-only";
import { randomInt } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditEvents, classes, classMemberships, students } from "@/lib/db/schema";
import { QR_TOKEN_ALPHABET } from "@/lib/packet/order";

/**
 * Students join a class by typing its class code, then saying who they are: their name as
 * the teacher has it, or their number in a numbered class. The roster is never shown to
 * them, so a code alone reveals no student names. Failed tries are capped per hour.
 */

export const JOIN_CODE_LENGTH = 6;
export const MAX_FAILED_JOINS_PER_HOUR = 10;

export function generateJoinCode() {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += QR_TOKEN_ALPHABET[randomInt(QR_TOKEN_ALPHABET.length)];
  return code;
}

/** "k7m 2qx" and "K7M-2QX" both mean K7M2QX. */
export function normalizeJoinCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Case, accents, spacing and punctuation do not matter: "José  O'Neil" matches "jose oneil". */
export function normalizeName(input: string) {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The class's code, made on first use. */
export async function ensureJoinCode(classId: string): Promise<string> {
  const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId), columns: { joinCode: true } });
  if (cls?.joinCode) return cls.joinCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateJoinCode();
    try {
      const [row] = await db
        .update(classes)
        .set({ joinCode: code })
        .where(and(eq(classes.id, classId), isNull(classes.joinCode)))
        .returning({ joinCode: classes.joinCode });
      if (row?.joinCode) return row.joinCode;
      const again = await db.query.classes.findFirst({ where: eq(classes.id, classId), columns: { joinCode: true } });
      if (again?.joinCode) return again.joinCode;
    } catch {
      // Another class already has this code. Try a new one.
    }
  }
  throw new Error("Could not make a class code.");
}

export async function findClassByCode(input: string) {
  const code = normalizeJoinCode(input);
  if (code.length !== JOIN_CODE_LENGTH) return null;
  return (await db.query.classes.findFirst({ where: and(eq(classes.joinCode, code), isNull(classes.archivedAt)) })) ?? null;
}

export async function failedJoinsInLastHour(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(auditEvents)
    .where(and(eq(auditEvents.userId, userId), eq(auditEvents.action, "class.join_failed"), gt(auditEvents.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  return row?.n ?? 0;
}

export type ClaimInput = { firstName?: string; lastName?: string; number?: number };

/**
 * Link a student account to its roster entry in a class. Returns the error to show,
 * worded so it never confirms which names or numbers are on the roster.
 */
export async function claimSeat(userId: string, classId: string, claim: ClaimInput) {
  const cls = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
  if (!cls) return { error: "That class code did not work. Check it with your teacher." } as const;

  const existing = await db.query.classMemberships.findFirst({
    where: and(eq(classMemberships.classId, classId), eq(classMemberships.userId, userId)),
  });
  if (existing) return { ok: true, membershipId: existing.id, alreadyJoined: true } as const;

  const roster = await db
    .select()
    .from(students)
    .where(and(eq(students.classId, classId), isNull(students.removedAt)));

  const matches =
    cls.rosterKind === "numbers"
      ? roster.filter((s) => claim.number !== undefined && s.number === claim.number)
      : roster.filter(
          (s) =>
            normalizeName(s.firstName) === normalizeName(claim.firstName ?? "") &&
            normalizeName(s.lastName) === normalizeName(claim.lastName ?? "") &&
            normalizeName(claim.firstName ?? "") !== "",
        );

  const notFound =
    cls.rosterKind === "numbers"
      ? `That number is not on the ${cls.name} roster. Check it with your teacher.`
      : `That name is not on the ${cls.name} roster. Check the spelling with your teacher.`;
  if (matches.length !== 1) return { error: notFound } as const;

  const taken = await db.query.classMemberships.findFirst({ where: eq(classMemberships.studentId, matches[0].id) });
  if (taken) return { error: "Someone already joined with that name or number. Ask your teacher to check." } as const;

  const [membership] = await db
    .insert(classMemberships)
    .values({ classId, userId, studentId: matches[0].id })
    .onConflictDoNothing()
    .returning({ id: classMemberships.id });
  if (!membership) return { error: "Someone already joined with that name or number. Ask your teacher to check." } as const;
  return { ok: true, membershipId: membership.id, alreadyJoined: false } as const;
}
