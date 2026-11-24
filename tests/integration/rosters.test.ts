/**
 * Numbered rosters against the test database: replacing names deletes them for good,
 * follows the order of the key the teacher downloaded, and refuses a stale key.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { resetTestDb } from "../support/db";

const { db } = await import("@/lib/db");
const schema = await import("@/lib/db/schema");
const { nextStudentNumber, numberedStudents, numberingOrder, replaceNames } = await import("@/lib/rosters");
const { rosterFor } = await import("@/lib/data");

async function namedClass(names: [string, string][]) {
  const teacherId = randomUUID();
  await db.insert(schema.user).values({ id: teacherId, name: "Test Teacher", email: `${teacherId}@example.com` });
  const [cls] = await db.insert(schema.classes).values({ teacherId, course: "APUSH", name: "Period 4" }).returning();
  if (names.length) {
    await db.insert(schema.students).values(names.map(([firstName, lastName]) => ({ classId: cls.id, teacherId, firstName, lastName })));
  }
  return { teacherId, cls };
}

describe("numbered rosters", () => {
  beforeAll(async () => {
    await resetTestDb();
  });

  it("numbers students in key order and deletes every name, removed students included", async () => {
    const { cls } = await namedClass([
      ["Maya", "Chen"],
      ["Daniel", "Rivera"],
      ["Ana", "Alvarez"],
    ]);
    const [rivera] = await db.select().from(schema.students).where(eq(schema.students.lastName, "Rivera"));
    await db.update(schema.students).set({ removedAt: new Date() }).where(eq(schema.students.id, rivera.id));

    const key = await numberingOrder(cls.id);
    expect(key.map((s) => [s.newNumber, s.lastName])).toEqual([
      [1, "Alvarez"],
      [2, "Chen"],
      [3, "Rivera"],
    ]);

    expect(await replaceNames(cls.id, key.map((s) => s.id))).toEqual({ ok: true, students: 3 });

    const after = await db.select().from(schema.students).where(eq(schema.students.classId, cls.id));
    expect(after.every((s) => s.firstName === "" && s.lastName === "")).toBe(true);
    expect(after.find((s) => s.id === key[0].id)?.number).toBe(1);
    expect(after.find((s) => s.id === rivera.id)?.number).toBe(3);
    const updated = await db.query.classes.findFirst({ where: eq(schema.classes.id, cls.id) });
    expect(updated?.rosterKind).toBe("numbers");
    expect((await rosterFor(cls.id)).map((s) => s.number)).toEqual([1, 2]);
  });

  it("refuses a key that no longer matches the roster", async () => {
    const { teacherId, cls } = await namedClass([
      ["Maya", "Chen"],
      ["Ana", "Alvarez"],
    ]);
    const key = await numberingOrder(cls.id);
    await db.insert(schema.students).values({ classId: cls.id, teacherId, firstName: "Zoe", lastName: "Baker" });

    expect(await replaceNames(cls.id, key.map((s) => s.id))).toEqual({ error: expect.stringContaining("Download the key again") });
    const still = await db.select().from(schema.students).where(eq(schema.students.classId, cls.id));
    expect(still.some((s) => s.lastName === "Chen")).toBe(true);
  });

  it("adds numbered students after the highest number", async () => {
    const { teacherId, cls } = await namedClass([]);
    await db.insert(schema.students).values(numberedStudents(cls.id, teacherId, 1, 3));
    expect(await nextStudentNumber(cls.id)).toBe(4);
    await db.insert(schema.students).values(numberedStudents(cls.id, teacherId, 4, 2));
    expect((await rosterFor(cls.id)).map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
  });
});
