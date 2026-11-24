import "server-only";
import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import { env } from "@/lib/env";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB; __dbSignature?: string; __sql?: postgres.Sql };

/**
 * Every export of the schema, with each table's columns. Next can load this module more than
 * once in one dev server (pages and route handlers), so compare content, not object identity.
 */
const SCHEMA_SIGNATURE = Object.entries(schema)
  .map(([name, value]) => (is(value, PgTable) ? `${name}(${Object.keys(getTableColumns(value)).join(",")})` : name))
  .sort()
  .join(";");

function client(): postgres.Sql {
  // prepare: false keeps us compatible with Neon's pooled (PgBouncer) endpoint.
  if (!globalForDb.__sql) globalForDb.__sql = postgres(env().DATABASE_URL, { prepare: false, max: 5 });
  return globalForDb.__sql;
}

/**
 * Shared Drizzle client. In development the connection pool is reused across hot reloads,
 * but the Drizzle wrapper is rebuilt whenever the schema module reloads (a `git pull` or a
 * schema edit while `next dev` runs). A wrapper built from an older schema does not know
 * new columns and fails with "No fields selected for table".
 */
export function getDb(): DB {
  if (!globalForDb.__db || globalForDb.__dbSignature !== SCHEMA_SIGNATURE) {
    globalForDb.__db = drizzle(client(), { schema });
    globalForDb.__dbSignature = SCHEMA_SIGNATURE;
  }
  return globalForDb.__db;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
