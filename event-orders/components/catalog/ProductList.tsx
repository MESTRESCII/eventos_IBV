"use client";

import { useCart } from "@/components/cart/CartContext";
import type { Product } from "@/db/repositories/products.repository";
import Link from "next/link";

export function ProductList({ products }: { products: Product[] }) {
  const { items, add, remove, count, total } = useCart();

  const quantityOf = (id: string) => items.find((i) => i.product.id === id)?.quantity ?? 0;

  if (products.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Nenhum produto disponível no momento.
      </p>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {products.map((product) => {
          const qty = quantityOf(product.id);
          const outOfStock = product.stock === 0;

          return (
            <li
              key={product.id}
              className="flex items-center justify-between rounded-xl border px-5 py-4 transition-shadow hover:shadow-sm"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                opacity: outOfStock ? 0.5 : 1,
              }}
            >
              {/* Info */}
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-semibold text-sm leading-tight">{product.name}</p>
                {product.description && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted)" }}>
                    {product.description}
                  </p>
                )}
                <p
                  className="text-sm font-semibold mt-1.5 tabular-nums"
                  style={{ color: "var(--primary)" }}
                >
                  R$ {Number(product.price).toFixed(2).replace(".", ",")}
                </p>
              </div>

              {/* Controles de quantidade */}
              <div className="flex items-center gap-2 shrink-0">
                {qty > 0 && (
                  <>
                    <button
                      onClick={() => remove(product.id)}
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold transition-colors hover:bg-stone-100"
                      style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
                      aria-label="Remover um"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">{qty}</span>
                  </>
                )}
                <button
                  onClick={() => add(product)}
                  disabled={outOfStock}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: outOfStock ? "var(--muted)" : "var(--primary)" }}
                  aria-label="Adicionar um"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Barra flutuante do carrinho */}
      {count > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
          <Link
            href="/checkout"
            className="flex items-center gap-4 text-white rounded-full px-6 py-3 shadow-xl transition-opacity hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            <span
              className="rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold tabular-nums"
              style={{ background: "rgba(255,255,255,0.25)" }}
            >
              {count}
            </span>
            <span className="font-semibold text-sm">Ver carrinho</span>
            <span className="font-mono text-sm tabular-nums">
              R$ {total.toFixed(2).replace(".", ",")}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
