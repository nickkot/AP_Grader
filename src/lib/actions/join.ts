"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { classes, user } from "@/lib/db/schema";
import { audit } from "@/lib/data";
import { claimSeat, failedJoinsInLastHour, findClassByCode, MAX_FAILED_JOINS_PER_HOUR, normalizeJoinCode } from "@/lib/join";
import { getSessionUser } from "@/lib/session";

export type JoinState =
  | { step: "code"; error?: string }
  | { step: "claim"; code: string; className: string; rosterKind: "names" | "numbers"; error?: string }
  | undefined;

const Claim = z.object({
  code: z.string().max(20),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  number: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * Two steps on one form: the class code, then who the student is. A teacher account
 * that owns classes cannot join; a new account becomes a student account when it joins.
 */
export async function joinClass(prev: JoinState, form: FormData): Promise<JoinState> {
  const me = await getSessionUser();
  if (!me) redirect("/join");

  if (me.kind === "teacher") {
    const [{ n }] = await db.select({ n: count() }).from(classes).where(eq(classes.teacherId, me.id));
    if (n > 0) return { step: "code", error: "This is a teacher account. Sign out, then sign in with your student account." };
  }
  if ((await failedJoinsInLastHour(me.id)) >= MAX_FAILED_JOINS_PER_HOUR) {
    return { step: "code", error: "Too many tries. Wait an hour or ask your teacher for help." };
  }

  const parsed = Claim.safeParse({
    code: form.get("code") ?? "",
    firstName: form.get("firstName") ?? undefined,
    lastName: form.get("lastName") ?? undefined,
    number: form.get("number") || undefined,
  });
  if (!parsed.success) return { step: "code", error: "Check the code and try again." };

  const cls = await findClassByCode(parsed.data.code);
  if (!cls) {
    await audit(me.id, "class.join_failed", "class", null, { reason: "code" });
    return { step: "code", error: "That class code did not work. Check it with your teacher." };
  }

  const claimStep = { step: "claim" as const, code: normalizeJoinCode(parsed.data.code), className: cls.name, rosterKind: cls.rosterKind };
  const claiming = parsed.data.number !== undefined || parsed.data.firstName !== undefined;
  if (!claiming || prev?.step !== "claim") return claimStep;

  const result = await claimSeat(me.id, cls.id, parsed.data);
  if ("error" in result) {
    await audit(me.id, "class.join_failed", "class", cls.id, { reason: "claim" });
    return { ...claimStep, error: result.error };
  }

  if (me.kind === "teacher") await db.update(user).set({ kind: "student" }).where(eq(user.id, me.id));
  if (!result.alreadyJoined) await audit(me.id, "class.join", "class", cls.id);
  redirect("/practice");
}
