import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const isMissingEnv = !process.env.DATABASE_URL;
if (isMissingEnv && process.env.NODE_ENV === "production" && process.env.VERCEL !== "1") {
  // Allow build-time imports without DATABASE_URL (Next.js page data collection)
  // Real runtime queries will still fail gracefully where caught
  console.warn("[db] DATABASE_URL not set — using dummy URL for build; runtime DB operations will fail if not configured");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
