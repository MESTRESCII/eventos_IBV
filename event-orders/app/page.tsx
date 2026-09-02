import { findActiveProducts } from "@/db/repositories/products.repository";
import { ProductList } from "@/components/catalog/ProductList";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const products = await findActiveProducts();

  return (
    <>
      {/* Header */}
      <header
        className="border-b"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div>
            <p className="font-semibold text-base leading-tight">IBV 2026</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Pedidos antecipados
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-32">
        <h1 className="text-xl font-bold mb-1">Cardápio</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          Escolha os itens e finalize seu pedido
        </p>
        <ProductList products={products} />
      </main>
    </>
  );
}
