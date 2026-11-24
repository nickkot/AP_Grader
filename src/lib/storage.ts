import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

/**
 * File storage for page photos, PDFs and generated packets.
 *
 * - s3: private bucket, server-side encryption (SSE-KMS), short-lived signed URLs.
 * - local: files under LOCAL_STORAGE_DIR, for development and tests. Uploads and
 *   downloads go through signed app routes so the browser code is the same.
 *
 * Keys never contain student names: `assignments/<assignmentId>/pages/<uuid>.jpg`.
 */

const SIGNED_URL_SECONDS = 300;

let s3: S3Client | undefined;
function s3Client() {
  if (!s3) s3 = new S3Client({ region: env().S3_REGION });
  return s3;
}

function localPath(key: string) {
  const root = path.resolve(env().LOCAL_STORAGE_DIR);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key.");
  return full;
}

function sign(payload: string) {
  return createHmac("sha256", env().BETTER_AUTH_SECRET).update(payload).digest("base64url");
}

/** Signature for local-driver upload and download URLs. */
export function signLocal(op: "put" | "get", key: string, expires: number) {
  return sign(`${op}:${key}:${expires}`);
}

export function verifyLocal(op: "put" | "get", key: string, expires: number, signature: string) {
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  const expected = Buffer.from(signLocal(op, key, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: e.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: e.S3_KMS_KEY_ID || undefined,
      }),
    );
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function getObject(key: string): Promise<Buffer> {
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    const res = await s3Client().send(new GetObjectCommand({ Bucket: e.S3_BUCKET, Key: key }));
    if (!res.Body) throw new Error(`Empty object: ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }
  return readFile(localPath(key));
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    if (env().STORAGE_DRIVER === "s3") {
      await getObject(key);
      return true;
    }
    await stat(localPath(key));
    return true;
  } catch {
    return false;
  }
}

/** URL the browser can PUT a file to directly. Keeps large photos off our servers on Vercel. */
export async function presignUpload(key: string, contentType: string): Promise<string> {
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    return getSignedUrl(
      s3Client(),
      new PutObjectCommand({
        Bucket: e.S3_BUCKET,
        Key: key,
        ContentType: contentType,
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: e.S3_KMS_KEY_ID || undefined,
      }),
      { expiresIn: SIGNED_URL_SECONDS },
    );
  }
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_SECONDS;
  const params = new URLSearchParams({ key, expires: String(expires), sig: signLocal("put", key, expires) });
  return `/api/storage?${params}`;
}

/** Short-lived URL for viewing a stored file. Callers must check access first. */
export async function presignDownload(key: string): Promise<string> {
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    return getSignedUrl(s3Client(), new GetObjectCommand({ Bucket: e.S3_BUCKET, Key: key }), {
      expiresIn: SIGNED_URL_SECONDS,
    });
  }
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_SECONDS;
  const params = new URLSearchParams({ key, expires: String(expires), sig: signLocal("get", key, expires) });
  return `/api/storage?${params}`;
}
