import { findActiveProducts } from "@/db/repositories/products.repository";
import { ProductList } from "@/components/catalog/ProductList";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const products = await findActiveProducts();

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 pb-28">
      <h1 className="text-2xl font-bold mb-2">Cardápio</h1>
      <p className="text-zinc-500 mb-8 text-sm">Evento IBV 2026</p>
      <ProductList products={products} />
    </main>
  );
}
