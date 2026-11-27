import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { handleClaim, workerAuthorized } from "@/lib/llm-queue/worker-api";

/** The local worker asks for its next job. */
export async function POST(req: Request) {
  if (!workerAuthorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json(await handleClaim(await req.json()));
  } catch (err) {
    if (err instanceof ZodError || err instanceof SyntaxError) return NextResponse.json({ error: "Bad request." }, { status: 400 });
    throw err;
  }
}
