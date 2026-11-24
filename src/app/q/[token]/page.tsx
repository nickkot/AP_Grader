import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { assignments, qrTokens } from "@/lib/db/schema";
import { getTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Answer sheet" };

/**
 * Scanning an answer sheet's QR code with a phone camera lands here.
 * The token is opaque; it only leads somewhere for the teacher who owns the assignment.
 */
export default async function QrLanding(props: PageProps<"/q/[token]">) {
  const { token } = await props.params;
  const teacher = await getTeacher();
  if (!teacher) redirect(`/sign-in?next=${encodeURIComponent(`/q/${token}`)}`);

  const row = /^[A-Za-z0-9_-]{6,40}$/.test(token)
    ? await db
        .select({ assignmentId: qrTokens.assignmentId, teacherId: assignments.teacherId })
        .from(qrTokens)
        .innerJoin(assignments, eq(assignments.id, qrTokens.assignmentId))
        .where(eq(qrTokens.token, token))
        .limit(1)
    : [];

  if (row[0] && row[0].teacherId === teacher.id) redirect(`/assignments/${row[0].assignmentId}/upload`);

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-2 px-4 py-16">
      <h1 className="text-xl font-semibold">This answer sheet is not in your account</h1>
      <p className="text-sm text-muted-foreground">
        Sign in with the account of the teacher who printed it, then scan the code again.
      </p>
    </main>
  );
}
