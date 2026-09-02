import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

export async function findActiveProducts() {
  return db.select().from(products).where(eq(products.active, true)).orderBy(products.name);
}
