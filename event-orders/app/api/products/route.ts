import { findActiveProducts } from "@/db/repositories/products.repository";

export async function GET() {
  try {
    const result = await findActiveProducts();
    return Response.json(result);
  } catch (error) {
    console.error("[products] Failed to fetch:", error);
    return Response.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
