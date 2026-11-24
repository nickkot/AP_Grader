import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export type Teacher = { id: string; name: string; email: string };
export type Student = { id: string; name: string; email: string };
export type SessionUser = { id: string; name: string; email: string; kind: "teacher" | "student" };

async function sessionUser(h: Headers): Promise<SessionUser | null> {
  const result = await getAuth().api.getSession({ headers: h });
  if (!result) return null;
  // The account kind lives in our user table; the session object only carries Better Auth's own fields.
  const row = await db.query.user.findFirst({ where: eq(user.id, result.user.id), columns: { kind: true } });
  return { id: result.user.id, name: result.user.name, email: result.user.email, kind: row?.kind ?? "teacher" };
}

/** Signed-in account of either kind, or null. Deduplicated per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => sessionUser(await headers()));

/** Current signed-in teacher, or null. Students are never teachers. */
export const getTeacher = cache(async (): Promise<Teacher | null> => {
  const u = await getSessionUser();
  return u?.kind === "teacher" ? { id: u.id, name: u.name, email: u.email } : null;
});

/** Current teacher, or redirect: to sign-in, or to practice for a student. Use at the top of every teacher page and action. */
export async function requireTeacher(): Promise<Teacher> {
  const u = await getSessionUser();
  if (!u) redirect("/sign-in");
  if (u.kind !== "teacher") redirect("/practice");
  return { id: u.id, name: u.name, email: u.email };
}

/** Current student, or redirect: to sign-in, or to classes for a teacher. Use at the top of every practice page and action. */
export async function requireStudent(): Promise<Student> {
  const u = await getSessionUser();
  if (!u) redirect("/sign-in?next=/practice");
  if (u.kind !== "student") redirect("/classes");
  return { id: u.id, name: u.name, email: u.email };
}

/** For route handlers: the teacher, or null instead of redirecting. */
export async function teacherFromRequest(req: Request): Promise<Teacher | null> {
  const u = await sessionUser(req.headers);
  return u?.kind === "teacher" ? { id: u.id, name: u.name, email: u.email } : null;
}
