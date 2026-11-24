import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { assignments, classes, rowScores, submissions } from "@/lib/db/schema";
import { audit, isUuid, rosterFor } from "@/lib/data";
import { latestRunIds } from "@/lib/pipeline/run";
import { getRubric } from "@/lib/rubrics";
import { teacherFromRequest } from "@/lib/session";
import { STATUS_LABEL, toStudentStatus } from "@/lib/views";

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Neutralize spreadsheet formulas, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: Request, ctx: RouteContext<"/api/assignments/[id]/export">) {
  const teacher = await teacherFromRequest(req);
  if (!teacher) return new NextResponse("Sign in to export scores.", { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const assignment = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, id), eq(assignments.teacherId, teacher.id)),
  });
  if (!assignment) return new NextResponse("Not found", { status: 404 });
  const cls = await db.query.classes.findFirst({ where: eq(classes.id, assignment.classId) });

  const rubric = getRubric(assignment.rubricKey, assignment.rubricVersion);
  const roster = await rosterFor(assignment.classId);
  const subs = await db.query.submissions.findMany({ where: eq(submissions.assignmentId, assignment.id) });
  const runIds = await latestRunIds(subs.map((s) => s.id));
  const rows = runIds.size ? await db.query.rowScores.findMany({ where: inArray(rowScores.scoreRunId, [...runIds.values()]) }) : [];

  const header = [
    "Last name",
    "First name",
    "Status",
    ...rubric.rows.map((r) => `${r.label} (${r.maxPoints})`),
    `Total (${rubric.maxPoints})`,
    ...rubric.rows.map((r) => `${r.label} comment`),
  ];
  const lines = [header.map(csvCell).join(",")];

  for (const st of roster) {
    const sub = subs.find((s) => s.studentId === st.id);
    const status = toStudentStatus(sub);
    const hasScores = status === "needs_review" || status === "approved";
    const byKey = new Map(rows.filter((r) => r.submissionId === sub?.id).map((r) => [r.rowKey, r]));
    const points = rubric.rows.map((r) => (hasScores ? (byKey.get(r.key)?.points ?? "") : ""));
    const total = hasScores ? rubric.rows.reduce((s, r) => s + (byKey.get(r.key)?.points ?? 0), 0) : "";
    const comments = rubric.rows.map((r) => (status === "approved" ? (byKey.get(r.key)?.studentFeedback ?? "") : ""));
    lines.push([st.lastName, st.firstName, STATUS_LABEL[status].label, ...points, total, ...comments].map(csvCell).join(","));
  }

  await audit(teacher.id, "scores.export", "assignment", assignment.id);
  const filename = `${cls?.name ?? "class"}-${assignment.title}`.replace(/[^A-Za-z0-9 -]+/g, "").trim().replace(/\s+/g, "-") || "scores";
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-scores.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
