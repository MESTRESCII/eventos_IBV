import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

// connection_limit=1 é necessário no Cloudflare Workers (sem conexões persistentes)
const client = postgres(databaseUrl, { max: 1 });

export const db = drizzle(client, { schema });
