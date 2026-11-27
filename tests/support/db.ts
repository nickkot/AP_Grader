import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Apply migrations to the test database and empty every table. */
export async function resetTestDb() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.execute(sql`truncate table "user", audit_event, llm_jobs, llm_worker cascade`);
  await client.end();
}
