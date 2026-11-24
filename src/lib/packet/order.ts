import { randomInt } from "node:crypto";

import type { PacketSheet } from "./render";

/**
 * Unambiguous token alphabet: digits 2-9 and capital letters without I, L and O,
 * so a token read aloud or typed from a smudged page cannot be confused.
 */
export const QR_TOKEN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const QR_TOKEN_LENGTH = 12;

/** Random opaque token for one answer page. Encodes nothing about the student. */
export function generateQrToken(): string {
  let token = "";
  for (let i = 0; i < QR_TOKEN_LENGTH; i++) {
    token += QR_TOKEN_ALPHABET[randomInt(QR_TOKEN_ALPHABET.length)];
  }
  return token;
}

export type OrderStudent = {
  id: string;
  firstName: string;
  lastName: string;
  /** Position on the class roster, used for roster order. */
  rosterIndex: number;
};

/** Shape of a qr_token row. Spare sheets have studentId null and a spareSet number. */
export type OrderToken = {
  token: string;
  studentId: string | null;
  pageNumber: number;
  spareSet?: number | null;
};

export type OrderSheetsInput = {
  students: OrderStudent[];
  tokens: OrderToken[];
  order: "roster" | "alphabetical";
  pagesPerStudent: number;
};

export function studentDisplayName(s: Pick<OrderStudent, "firstName" | "lastName">): string {
  return [s.firstName.trim(), s.lastName.trim()].filter(Boolean).join(" ");
}

function compareAlphabetical(a: OrderStudent, b: OrderStudent): number {
  const opts = { sensitivity: "base" } as const;
  return (
    a.lastName.localeCompare(b.lastName, "en", opts) ||
    a.firstName.localeCompare(b.firstName, "en", opts) ||
    a.rosterIndex - b.rosterIndex
  );
}

/**
 * Puts answer sheets in print order: each student's pages 1..N in the chosen
 * order, then the spare sets. Throws if a student is missing a token for any page,
 * so a packet can never print with a gap.
 */
export function orderSheets(input: OrderSheetsInput): PacketSheet[] {
  const { students, tokens, order, pagesPerStudent } = input;
  if (!Number.isInteger(pagesPerStudent) || pagesPerStudent < 1) {
    throw new Error("pagesPerStudent must be a positive whole number.");
  }

  const byStudent = new Map<string, Map<number, string>>();
  const spares = new Map<number, OrderToken[]>();
  for (const t of tokens) {
    if (t.studentId) {
      let pages = byStudent.get(t.studentId);
      if (!pages) {
        pages = new Map();
        byStudent.set(t.studentId, pages);
      }
      pages.set(t.pageNumber, t.token);
    } else {
      const set = t.spareSet ?? 0;
      const list = spares.get(set) ?? [];
      list.push(t);
      spares.set(set, list);
    }
  }

  const sorted = [...students].sort(
    order === "alphabetical" ? compareAlphabetical : (a, b) => a.rosterIndex - b.rosterIndex,
  );

  const sheets: PacketSheet[] = [];
  for (const student of sorted) {
    const pages = byStudent.get(student.id);
    const name = studentDisplayName(student);
    for (let page = 1; page <= pagesPerStudent; page++) {
      const token = pages?.get(page);
      if (!token) throw new Error(`Missing QR token for ${name}, page ${page}.`);
      sheets.push({ token, studentName: name, pageNumber: page, pageCount: pagesPerStudent });
    }
  }

  for (const set of [...spares.keys()].sort((a, b) => a - b)) {
    const list = spares.get(set)!.sort((a, b) => a.pageNumber - b.pageNumber);
    for (const t of list) {
      sheets.push({ token: t.token, studentName: null, pageNumber: t.pageNumber, pageCount: list.length, spareSet: set });
    }
  }

  return sheets;
}
