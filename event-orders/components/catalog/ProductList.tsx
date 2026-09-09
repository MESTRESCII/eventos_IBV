"use client";

import { useCart } from "@/components/cart/CartContext";
import type { Product } from "@/db/repositories/products.repository";
import { PRODUCT_CATEGORIES, CATEGORY_PLACEHOLDER } from "@/types";
import Link from "next/link";

type Props = {
  products: Product[];
  cutoffPassed?: boolean;
};

/** Agrupa produtos por categoria, respeitando a ordem definida em PRODUCT_CATEGORIES. */
function groupByCategory(products: Product[]): { category: string; items: Product[] }[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    // Defensivo: banco sem a coluna category ainda (migration pendente) não deve quebrar a UI.
    const category = product.category?.trim() || "Outros";
    const list = groups.get(category) ?? [];
    list.push(product);
    groups.set(category, list);
  }

  const knownOrder = PRODUCT_CATEGORIES.filter((c) => groups.has(c));
  const extra = [...groups.keys()].filter((c) => !PRODUCT_CATEGORIES.includes(c as never)).sort();

  return [...knownOrder, ...extra].map((category) => ({
    category,
    items: groups.get(category)!,
  }));
}

/** Foto do produto — placeholder emoji por categoria enquanto não há image_url real. */
function ProductThumb({ product }: { product: Product }) {
  if (product.image_url) {
    return (
      <div
        className="w-16 h-16 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0"
        style={{ background: "var(--border)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- image_url pode ser de qualquer host; sem next/image até definirmos onde as fotos ficam hospedadas */}
        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className="w-16 h-16 sm:w-14 sm:h-14 rounded-lg shrink-0 flex items-center justify-center text-2xl"
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
      aria-hidden
    >
      {CATEGORY_PLACEHOLDER[product.category] ?? "🍽️"}
    </div>
  );
}

export function ProductList({ products, cutoffPassed = false }: Props) {
  const { items, add, remove, count, total } = useCart();

  const quantityOf = (id: string) => items.find((i) => i.product.id === id)?.quantity ?? 0;

  if (products.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Nenhum produto disponível no momento.
      </p>
    );
  }

  const groups = groupByCategory(products);

  return (
    <div>
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <section key={group.category}>
            <h2
              className="text-sm font-bold uppercase tracking-widest mb-3"
              style={{ color: "var(--primary)" }}
            >
              {group.category}
            </h2>
            <ul className="flex flex-col gap-3">
              {group.items.map((product) => {
                const qty = quantityOf(product.id);
                const outOfStock = product.stock === 0;
                const disabled = outOfStock || cutoffPassed;

                return (
                  <li
                    key={product.id}
                    className="flex items-center gap-3 rounded-xl border px-4 py-3 sm:px-5 sm:py-4 transition-shadow hover:shadow-sm"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <ProductThumb product={product} />

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base leading-tight">{product.name}</p>
                      {product.description && (
                        <p
                          className="text-sm mt-0.5 leading-relaxed"
                          style={{ color: "var(--muted)" }}
                        >
                          {product.description}
                        </p>
                      )}
                      <p
                        className="text-base font-semibold mt-1.5 tabular-nums"
                        style={{ color: "var(--primary)" }}
                      >
                        R$ {Number(product.price).toFixed(2).replace(".", ",")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {qty > 0 && !cutoffPassed && (
                        <>
                          <button
                            onClick={() => remove(product.id)}
                            className="w-9 h-9 rounded-full border flex items-center justify-center text-base font-bold transition-colors hover:bg-stone-100"
                            style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
                            aria-label="Remover um"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-base font-bold tabular-nums">
                            {qty}
                          </span>
                        </>
                      )}
                      <button
                        onClick={() => !cutoffPassed && add(product)}
                        disabled={disabled}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: disabled ? "var(--muted)" : "var(--primary)" }}
                        aria-label="Adicionar um"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Barra flutuante do carrinho — oculta quando encerrado */}
      {count > 0 && !cutoffPassed && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50">
          <Link
            href="/checkout"
            className="flex items-center gap-4 text-white rounded-full px-6 py-3.5 shadow-xl transition-opacity hover:opacity-90"
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
