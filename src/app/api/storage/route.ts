import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getObject, putObject, verifyLocal } from "@/lib/storage";

/**
 * Local storage driver only: signed upload and download URLs point here.
 * With STORAGE_DRIVER=s3 the browser talks to S3 directly and this route is off.
 */

const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

function params(req: Request) {
  const url = new URL(req.url);
  return {
    key: url.searchParams.get("key") ?? "",
    expires: Number(url.searchParams.get("expires")),
    sig: url.searchParams.get("sig") ?? "",
  };
}

export async function GET(req: Request) {
  if (env().STORAGE_DRIVER !== "local") return new NextResponse("Not found", { status: 404 });
  const { key, expires, sig } = params(req);
  if (!verifyLocal("get", key, expires, sig)) return new NextResponse("Link expired", { status: 403 });
  try {
    const body = await getObject(key);
    const type = key.endsWith(".pdf") ? "application/pdf" : key.endsWith(".png") ? "image/png" : "image/jpeg";
    return new NextResponse(new Uint8Array(body), {
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function PUT(req: Request) {
  if (env().STORAGE_DRIVER !== "local") return new NextResponse("Not found", { status: 404 });
  const { key, expires, sig } = params(req);
  if (!verifyLocal("put", key, expires, sig)) return new NextResponse("Link expired", { status: 403 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length === 0 || body.length > MAX_UPLOAD_BYTES) {
    return new NextResponse("File is empty or too large", { status: 413 });
  }
  await putObject(key, body, req.headers.get("content-type") ?? "application/octet-stream");
  return new NextResponse(null, { status: 200 });
}
