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
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          Seu carrinho está vazio.
        </p>
        <Link
          href="/"
          className="text-sm font-medium underline underline-offset-2"
          style={{ color: "var(--primary)" }}
        >
          Ver cardápio
        </Link>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
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
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow";

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <header
        className="border-b"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="max-w-md mx-auto px-4 py-4">
          <Link href="/" className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            ← Voltar ao cardápio
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6">Finalizar pedido</h1>

        {/* Resumo */}
        <div
          className="rounded-xl border p-4 mb-6"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--muted)" }}
          >
            Resumo
          </p>
          <ul className="flex flex-col gap-2 mb-3">
            {items.map((item) => (
              <li key={item.product.id} className="flex justify-between text-sm">
                <span>
                  {item.quantity}× {item.product.name}
                </span>
                <span className="font-mono tabular-nums">
                  R$ {(Number(item.product.price) * item.quantity).toFixed(2).replace(".", ",")}
                </span>
              </li>
            ))}
          </ul>
          <div
            className="border-t pt-3 flex justify-between font-semibold text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            <span>Total</span>
            <span className="font-mono tabular-nums" style={{ color: "var(--primary)" }}>
              R$ {total.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>

        {/* Formulário */}
        <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor={`${formId}-name`}>
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
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor={`${formId}-email`}>
              E-mail
            </label>
            <input
              id={`${formId}-email`}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor={`${formId}-date`}>
              Data de retirada
            </label>
            <input
              id={`${formId}-date`}
              type="date"
              required
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className={inputClass}
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          {error && (
            <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="text-white rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed mt-1 flex items-center justify-center gap-2"
            style={{ background: "var(--primary)" }}
          >
            {loading && (
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                  flexShrink: 0,
                }}
              />
            )}
            {loading ? "Criando pedido…" : "Confirmar pedido"}
          </button>
        </form>
      </main>
    </>
  );
}
