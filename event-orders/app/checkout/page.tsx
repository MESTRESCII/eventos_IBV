"use client";

import { useCart } from "@/components/cart/CartContext";
import { useRouter } from "next/navigation";
import { useState, useId } from "react";
import Link from "next/link";

type Stage = "form" | "choice";

export default function CheckoutPage() {
  const { items, total, count, clear } = useCart();
  const router = useRouter();
  const formId = useId();

  const [name, setName] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (count === 0 && stage === "form") {
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

  /**
   * Submit do formulário: apenas valida o nome e avança para a tela de escolha.
   * O pedido ainda NÃO é criado aqui — só é criado quando o usuário escolhe como pagar.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || name.trim().length < 3) return;
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setIdempotencyKey(key);
    setError(null);
    setStage("choice");
  }

  /**
   * Pagar no evento: cria o pedido como PENDING e redireciona para o comprovante.
   */
  async function handlePayLater() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          idempotency_key: idempotencyKey,
          items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao criar pedido. Tente novamente.");
        setLoading(false);
        return;
      }

      clear();
      router.push(`/orders/${data.public_id}?comprovante=1`);
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  /**
   * Pagar agora: cria o pedido como AWAITING_PAYMENT e inicia o checkout InfinitePay.
   * O pedido só aparece no admin e no Sheets após o pagamento ser confirmado via webhook.
   */
  async function handlePayNow() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout/pay-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          idempotency_key: idempotencyKey,
          items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao processar pagamento. Tente novamente.");
        setLoading(false);
        return;
      }

      clear();
      window.location.href = data.checkout_url;
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow";

  /* ── Tela de escolha de pagamento ── */
  if (stage === "choice") {
    return (
      <>
        <header
          className="border-b"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="max-w-md mx-auto px-4 py-4">
            <button
              onClick={() => {
                setStage("form");
                setError(null);
              }}
              className="text-xs font-medium"
              style={{ color: "var(--muted)" }}
            >
              ← Voltar
            </button>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <span style={{ fontSize: "3rem" }}>🛒</span>
            <h1 className="text-xl font-bold mt-3 mb-1">Como deseja pagar?</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Pedido de <span className="font-semibold">{name.trim()}</span> · Total:{" "}
              <span className="font-mono font-bold" style={{ color: "var(--primary)" }}>
                R$ {total.toFixed(2).replace(".", ",")}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Pagar agora */}
            <button
              onClick={handlePayNow}
              disabled={loading}
              className="w-full rounded-xl border-2 px-4 py-4 text-left transition-all disabled:opacity-60"
              style={{ borderColor: "var(--primary)", background: "var(--card)" }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "1.75rem" }}>💳</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                    {loading ? "Processando…" : "Pagar agora"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    Pix ou cartão — pagamento imediato
                  </p>
                </div>
              </div>
            </button>

            {/* Pagar no evento */}
            <button
              onClick={handlePayLater}
              disabled={loading}
              className="w-full rounded-xl border px-4 py-4 text-left transition-all disabled:opacity-60"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "1.75rem" }}>🗓️</span>
                <div>
                  <p className="text-sm font-bold">Pagar no evento</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    Pedido fica pendente até o dia 26/09
                  </p>
                </div>
              </div>
            </button>
          </div>

          {error && (
            <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 mt-4">
              {error}
            </p>
          )}
        </main>
      </>
    );
  }

  /* ── Formulário de pedido ── */
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

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
            {loading ? "Aguarde…" : "Continuar"}
          </button>
        </form>
      </main>
    </>
  );
}
