/**
 * How a student is shown. A class can list students by name, or by number when the
 * teacher keeps names out of the app (then first and last name are empty).
 * Safe to import from client and server code.
 */

export type NamedStudent = { firstName: string; lastName: string; number?: number | null };

/** "Maya Chen", or "Student 12" in a numbered class. */
export function studentName(s: NamedStudent): string {
  if (s.number != null) return `Student ${s.number}`;
  return [s.firstName.trim(), s.lastName.trim()].filter(Boolean).join(" ");
}

/** Roster form: "Chen, Maya", or "Student 12" in a numbered class. */
export function rosterLabel(s: NamedStudent): string {
  if (s.number != null) return `Student ${s.number}`;
  return s.lastName ? `${s.lastName}, ${s.firstName}` : s.firstName;
}

/** Roster order: by number in a numbered class, else last name then first name. */
export function compareStudents(a: NamedStudent, b: NamedStudent): number {
  if (a.number != null && b.number != null) return a.number - b.number;
  if (a.number != null) return -1;
  if (b.number != null) return 1;
  const opts = { sensitivity: "base" } as const;
  return a.lastName.localeCompare(b.lastName, "en", opts) || a.firstName.localeCompare(b.firstName, "en", opts);
}
