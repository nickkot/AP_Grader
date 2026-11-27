import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { handleJobAction, workerAuthorized } from "@/lib/llm-queue/worker-api";

/** The local worker reports on a job it claimed: complete, fail, release or extend. */
export async function POST(req: Request, ctx: RouteContext<"/api/llm-worker/jobs/[id]/[action]">) {
  if (!workerAuthorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id, action } = await ctx.params;
  try {
    const result = await handleJobAction(id, action, await req.json());
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    if (err instanceof ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "Bad request." }, { status: 400 });
    throw err;
  }
}
