import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

// max: 1       → Workers são stateless, sem conexões persistentes
// prepare: false → obrigatório para PgBouncer em modo transaction (porta 6543)
const client = postgres(databaseUrl, { max: 1, prepare: false });

export const db = drizzle(client, { schema });
