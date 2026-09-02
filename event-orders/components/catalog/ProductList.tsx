"use client";

import { useCart } from "@/components/cart/CartContext";
import type { Product } from "@/db/repositories/products.repository";
import Link from "next/link";

export function ProductList({ products }: { products: Product[] }) {
  const { items, add, remove, count, total } = useCart();

  const quantityOf = (id: string) => items.find((i) => i.product.id === id)?.quantity ?? 0;

  if (products.length === 0) {
    return <p className="text-zinc-400">Nenhum produto disponível no momento.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {products.map((product) => {
          const qty = quantityOf(product.id);
          return (
            <li
              key={product.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-semibold">{product.name}</p>
                {product.description && (
                  <p className="text-sm text-zinc-500 truncate">{product.description}</p>
                )}
                <p className="font-mono text-sm text-zinc-700 mt-1">
                  R$ {Number(product.price).toFixed(2).replace(".", ",")}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {qty > 0 ? (
                  <>
                    <button
                      onClick={() => remove(product.id)}
                      className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 transition-colors"
                      aria-label="Remover um"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-semibold tabular-nums">{qty}</span>
                  </>
                ) : null}
                <button
                  onClick={() => add(product)}
                  disabled={product.stock === 0}
                  className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Adicionar um"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {count > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4">
          <Link
            href="/checkout"
            className="flex items-center gap-4 bg-zinc-900 text-white rounded-full px-6 py-3 shadow-lg hover:bg-zinc-700 transition-colors"
          >
            <span className="bg-white text-zinc-900 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold tabular-nums">
              {count}
            </span>
            <span className="font-semibold">Ver carrinho</span>
            <span className="font-mono">R$ {total.toFixed(2).replace(".", ",")}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
