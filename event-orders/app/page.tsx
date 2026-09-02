import { findActiveProducts } from "@/db/repositories/products.repository";

// Esta página lê do banco em toda request — sem cache estático
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const products = await findActiveProducts();

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Cardápio</h1>
      <p className="text-zinc-500 mb-8 text-sm">Evento IBV 2026</p>

      {products.length === 0 ? (
        <p className="text-zinc-400">Nenhum produto disponível no momento.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm"
            >
              <div>
                <p className="font-semibold">{product.name}</p>
                {product.description && (
                  <p className="text-sm text-zinc-500">{product.description}</p>
                )}
              </div>
              <span className="font-mono text-zinc-800 shrink-0 ml-4">
                R$ {Number(product.price).toFixed(2).replace(".", ",")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
