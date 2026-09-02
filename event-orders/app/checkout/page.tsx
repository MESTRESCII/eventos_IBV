"use client";

import { useCart } from "@/components/cart/CartContext";
import { useRouter } from "next/navigation";
import { useState, useId } from "react";
import Link from "next/link";

export default function CheckoutPage() {
  const { items, total, count, clear } = useCart();
  const router = useRouter();
  const formId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pickupDate, setPickupDate] = useState("2026-09-15");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (count === 0) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-zinc-500 mb-6">Seu carrinho está vazio.</p>
        <Link href="/" className="text-zinc-900 underline underline-offset-2">
          Ver cardápio
        </Link>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_email: email.trim().toLowerCase(),
          pickup_date: pickupDate,
          idempotency_key: idempotencyKey,
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao criar pedido. Tente novamente.");
        return;
      }

      clear();
      router.push(`/orders/${data.public_id}`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 mb-8 inline-block">
        ← Voltar ao cardápio
      </Link>

      <h1 className="text-2xl font-bold mb-6">Finalizar pedido</h1>

      {/* Resumo do carrinho */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide mb-3">Resumo</h2>
        <ul className="flex flex-col gap-2 mb-3">
          {items.map((item) => (
            <li key={item.product.id} className="flex justify-between text-sm">
              <span>
                {item.quantity}× {item.product.name}
              </span>
              <span className="font-mono">
                R$ {(Number(item.product.price) * item.quantity).toFixed(2).replace(".", ",")}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-zinc-100 pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span className="font-mono">R$ {total.toFixed(2).replace(".", ",")}</span>
        </div>
      </div>

      {/* Formulário */}
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`${formId}-name`}>
            Nome completo
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            required
            minLength={3}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`${formId}-email`}>
            E-mail
          </label>
          <input
            id={`${formId}-email`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor={`${formId}-date`}>
            Data de retirada
          </label>
          <input
            id={`${formId}-date`}
            type="date"
            required
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-zinc-900 text-white rounded-lg px-4 py-3 font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Criando pedido…" : "Confirmar pedido"}
        </button>
      </form>
    </main>
  );
}
