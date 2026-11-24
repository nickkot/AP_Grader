import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import { env } from "@/lib/env";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB; __sql?: postgres.Sql };

function create(): DB {
  // prepare: false keeps us compatible with Neon's pooled (PgBouncer) endpoint.
  const client = postgres(env().DATABASE_URL, { prepare: false, max: 5 });
  globalForDb.__sql = client;
  return drizzle(client, { schema });
}

/** Shared Drizzle client. Reused across hot reloads in development. */
export function getDb(): DB {
  if (!globalForDb.__db) globalForDb.__db = create();
  return globalForDb.__db;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
