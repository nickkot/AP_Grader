import { and, asc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { assignments, classes, students } from "@/lib/db/schema";
import { audit, isUuid } from "@/lib/data";
import { env } from "@/lib/env";
import { orderSheets } from "@/lib/packet/order";
import { renderPacketPdf } from "@/lib/packet/render";
import { ensurePacketTokens } from "@/lib/packet/tokens";
import { COURSES, ESSAY_TYPES, getRubric } from "@/lib/rubrics";
import { teacherFromRequest } from "@/lib/session";

export const maxDuration = 120;

const Options = z.object({
  order: z.enum(["roster", "alphabetical"]).default("alphabetical"),
  pages: z.coerce.number().int().min(1).max(8).optional(),
  spares: z.coerce.number().int().min(0).max(20).default(3),
  paper: z.enum(["LETTER", "A4"]).default("LETTER"),
  duplex: z.enum(["0", "1"]).default("0"),
});

export async function GET(req: Request, ctx: RouteContext<"/api/assignments/[id]/packet">) {
  const teacher = await teacherFromRequest(req);
  if (!teacher) return new NextResponse("Sign in to print packets.", { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const assignment = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, id), eq(assignments.teacherId, teacher.id)),
  });
  if (!assignment) return new NextResponse("Not found", { status: 404 });
  const cls = await db.query.classes.findFirst({ where: eq(classes.id, assignment.classId) });
  if (!cls) return new NextResponse("Not found", { status: 404 });

  const parsed = Options.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return new NextResponse("Invalid packet options.", { status: 400 });
  const opts = parsed.data;
  const pagesPerStudent = opts.pages ?? assignment.answerPagesPerStudent;

  if (pagesPerStudent !== assignment.answerPagesPerStudent) {
    await db.update(assignments).set({ answerPagesPerStudent: pagesPerStudent }).where(eq(assignments.id, assignment.id));
  }

  const roster = await db
    .select()
    .from(students)
    .where(and(eq(students.classId, cls.id), isNull(students.removedAt)))
    .orderBy(asc(students.createdAt), asc(students.id));

  const { studentTokens, spareTokens } = await ensurePacketTokens({
    assignmentId: assignment.id,
    studentIds: roster.map((s) => s.id),
    pagesPerStudent,
    spareSets: opts.spares,
  });

  const sheets = orderSheets({
    students: roster.map((s, i) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, rosterIndex: i })),
    tokens: [...studentTokens, ...spareTokens],
    order: opts.order,
    pagesPerStudent,
  });

  const rubric = getRubric(assignment.rubricKey, assignment.rubricVersion);
  const essayType = ESSAY_TYPES[assignment.essayType];
  const pdf = await renderPacketPdf({
    appUrl: env().APP_URL,
    className: cls.name,
    courseLabel: COURSES[cls.course].label,
    assignmentTitle: assignment.title,
    essayTypeLabel: essayType.label,
    promptText: assignment.promptText,
    sources: assignment.sources,
    timeLimitMinutes: assignment.timeLimitMinutes,
    readingMinutes: assignment.readingMinutes,
    rubricRows: rubric.rows.map((r) => ({ label: r.label, maxPoints: r.maxPoints, studentWording: r.studentWording })),
    sheets,
    paperSize: opts.paper,
    doubleSided: opts.duplex === "1",
  });

  await audit(teacher.id, "packet.print", "assignment", assignment.id, { ...opts, pagesPerStudent, sheets: sheets.length });

  const filename = `${cls.name}-${assignment.title}`.replace(/[^A-Za-z0-9 -]+/g, "").trim().replace(/\s+/g, "-") || "packet";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}-packet.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
