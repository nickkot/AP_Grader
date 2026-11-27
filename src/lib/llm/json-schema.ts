import "server-only";
import { z } from "zod";

const SAFE = Number.MAX_SAFE_INTEGER;

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema") continue;
    // zod adds +-2^53 bounds to integers; local models' grammar compilers choke on them.
    if ((key === "minimum" || key === "maximum") && typeof value === "number" && Math.abs(value) >= SAFE) continue;
    out[key] = clean(value);
  }
  return out;
}

/** JSON Schema for a zod schema, in the plain form OpenAI-compatible servers accept. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return clean(z.toJSONSchema(schema)) as Record<string, unknown>;
}
