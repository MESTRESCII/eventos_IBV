"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { Order } from "@/db/repositories/orders.repository";

type Tab = "PENDING" | "AWAITING_PREP" | "READY" | "DELIVERED";

function fmtTotal(v: string) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
function fmtItems(items: Order["items"]) {
  return items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
}

export function OrderTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-refresh a cada 10 segundos
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [router]);

  const pending = orders.filter((o) => o.payment_status === "PENDING");
  const awaitingPrep = orders.filter(
    (o) => o.payment_status === "PAID" && o.order_status === "CREATED",
  );
  const ready = orders.filter((o) => o.payment_status === "PAID" && o.order_status === "READY");
  const delivered = orders.filter((o) => o.order_status === "DELIVERED");

  const sortAsc = (a: Order, b: Order) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  const sortPaidAsc = (a: Order, b: Order) =>
    new Date(a.paid_at ?? a.created_at).getTime() - new Date(b.paid_at ?? b.created_at).getTime();
  const sortDeliveredDesc = (a: Order, b: Order) =>
    new Date(b.delivered_at ?? b.created_at).getTime() -
    new Date(a.delivered_at ?? a.created_at).getTime();

  const displayed =
    tab === "PENDING"
      ? [...pending].sort(sortAsc)
      : tab === "AWAITING_PREP"
        ? [...awaitingPrep].sort(sortPaidAsc)
        : tab === "READY"
          ? [...ready].sort(sortPaidAsc)
          : [...delivered].sort(sortDeliveredDesc);

  async function action(publicId: string, endpoint: "pay" | "ready" | "deliver") {
    setLoading(`${publicId}:${endpoint}`);
    try {
      const res = await fetch(`/api/admin/orders/${publicId}/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "Erro.");
        return;
      }
      const msgs: Record<typeof endpoint, string> = {
        pay: `✅ ${publicId} marcado como pago.`,
        ready: `🍽️ ${publicId} pronto para retirada.`,
        deliver: `📦 ${publicId} entregue.`,
      };
      setToast(msgs[endpoint]);
      router.refresh();
    } catch {
      setToast("Erro de conexão.");
    } finally {
      setLoading(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "PENDING", label: "Pendentes", count: pending.length },
    { key: "AWAITING_PREP", label: "Pagos", count: awaitingPrep.length },
    { key: "READY", label: "Prontos", count: ready.length },
    { key: "DELIVERED", label: "Entregues", count: delivered.length },
  ];

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
            style={{
              background: tab === t.key ? "var(--primary)" : "var(--card)",
              color: tab === t.key ? "#fff" : "var(--foreground)",
              borderColor: tab === t.key ? "var(--primary)" : "var(--border)",
            }}
          >
            {t.label} ({t.count})
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
          ↻ 10s
        </span>
      </div>

      {/* Tabela */}
      {displayed.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>
          Nenhum pedido nesta aba.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: `1px solid var(--border)` }}>
                {["Código", "Nome", "Itens", "Total", "Ações"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2.5 font-semibold whitespace-nowrap"
                    style={{ color: "var(--muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((o, i) => (
                <tr
                  key={o.id}
                  style={{
                    background: i % 2 === 0 ? "var(--background)" : "var(--card)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <td
                    className="px-3 py-2 font-bold font-mono tracking-widest"
                    style={{ color: "var(--primary)" }}
                  >
                    {o.public_id}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{o.customer_name}</td>
                  <td className="px-3 py-2 max-w-xs" style={{ color: "var(--muted)" }}>
                    {fmtItems(o.items)}
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    {fmtTotal(o.total_amount)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      {o.payment_status === "PENDING" && (
                        <button
                          onClick={() => action(o.public_id, "pay")}
                          disabled={loading !== null}
                          className="rounded px-2 py-1 font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                          style={{ background: "#16A34A" }}
                        >
                          {loading === `${o.public_id}:pay` ? "…" : "Confirmar Pag."}
                        </button>
                      )}
                      {o.payment_status === "PAID" && o.order_status === "CREATED" && (
                        <button
                          onClick={() => action(o.public_id, "ready")}
                          disabled={loading !== null}
                          className="rounded px-2 py-1 font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                          style={{ background: "#D97706" }}
                        >
                          {loading === `${o.public_id}:ready` ? "…" : "Marcar Pronto"}
                        </button>
                      )}
                      {o.payment_status === "PAID" && o.order_status === "READY" && (
                        <button
                          onClick={() => action(o.public_id, "deliver")}
                          disabled={loading !== null}
                          className="rounded px-2 py-1 font-semibold text-white disabled:opacity-50"
                          style={{ background: "var(--primary)" }}
                        >
                          {loading === `${o.public_id}:deliver` ? "…" : "Entregar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
