import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";

export type Teacher = { id: string; name: string; email: string };

/** Current signed-in teacher, or null. Deduplicated per request. */
export const getTeacher = cache(async (): Promise<Teacher | null> => {
  const result = await getAuth().api.getSession({ headers: await headers() });
  if (!result) return null;
  return { id: result.user.id, name: result.user.name, email: result.user.email };
});

/** Current teacher, or redirect to sign-in. Use at the top of every page and action. */
export async function requireTeacher(): Promise<Teacher> {
  const teacher = await getTeacher();
  if (!teacher) redirect("/sign-in");
  return teacher;
}

/** For route handlers: returns null instead of redirecting. */
export async function teacherFromRequest(req: Request): Promise<Teacher | null> {
  const result = await getAuth().api.getSession({ headers: req.headers });
  if (!result) return null;
  return { id: result.user.id, name: result.user.name, email: result.user.email };
}
