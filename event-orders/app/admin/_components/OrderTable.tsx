"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Order } from "@/db/repositories/orders.repository";

const P_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  FAILED: "Falhou",
  EXPIRED: "Expirado",
};
const O_LABEL: Record<string, string> = {
  CREATED: "Criado",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};
const P_COLOR: Record<string, string> = {
  PENDING: "#92400E",
  PAID: "#166534",
  FAILED: "#991B1B",
  EXPIRED: "#374151",
};
const P_BG: Record<string, string> = {
  PENDING: "#FFFBEB",
  PAID: "#F0FDF4",
  FAILED: "#FEF2F2",
  EXPIRED: "#F3F4F6",
};

type Filter = "TODOS" | "PENDING" | "PAID" | "DELIVERED";

function fmtTotal(v: string) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
function fmtItems(items: Order["items"]) {
  return items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function OrderTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("TODOS");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filters: Filter[] = ["TODOS", "PENDING", "PAID", "DELIVERED"];
  const filtered = orders.filter((o) => {
    if (filter === "TODOS") return true;
    if (filter === "PENDING") return o.payment_status === "PENDING";
    if (filter === "PAID") return o.payment_status === "PAID" && o.order_status !== "DELIVERED";
    if (filter === "DELIVERED") return o.order_status === "DELIVERED";
    return true;
  });

  async function action(publicId: string, endpoint: "pay" | "deliver") {
    setLoading(`${publicId}:${endpoint}`);
    try {
      const res = await fetch(`/api/admin/orders/${publicId}/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "Erro.");
        return;
      }
      setToast(
        endpoint === "pay" ? `✅ ${publicId} marcado como pago.` : `📦 ${publicId} entregue.`,
      );
      router.refresh();
    } catch {
      setToast("Erro de conexão.");
    } finally {
      setLoading(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

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

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
            style={{
              background: filter === f ? "var(--primary)" : "var(--card)",
              color: filter === f ? "#fff" : "var(--foreground)",
              borderColor: filter === f ? "var(--primary)" : "var(--border)",
            }}
          >
            {f === "TODOS"
              ? `Todos (${orders.length})`
              : f === "PENDING"
                ? `Pendentes (${orders.filter((o) => o.payment_status === "PENDING").length})`
                : f === "PAID"
                  ? `Pagos (${orders.filter((o) => o.payment_status === "PAID" && o.order_status !== "DELIVERED").length})`
                  : `Entregues (${orders.filter((o) => o.order_status === "DELIVERED").length})`}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>
          Nenhum pedido neste filtro.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: `1px solid var(--border)` }}>
                {[
                  "Código",
                  "Nome",
                  "Itens",
                  "Total",
                  "Pagamento",
                  "Status",
                  "Criado em",
                  "Ações",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-semibold text-xs whitespace-nowrap"
                    style={{ color: "var(--muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr
                  key={o.id}
                  style={{
                    background: i % 2 === 0 ? "var(--background)" : "var(--card)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <td
                    className="px-4 py-3 font-bold font-mono tracking-widest"
                    style={{ color: "var(--primary)" }}
                  >
                    {o.public_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{o.customer_name}</td>
                  <td className="px-4 py-3 max-w-xs" style={{ color: "var(--muted)" }}>
                    <span className="text-xs">{fmtItems(o.items)}</span>
                  </td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">
                    {fmtTotal(o.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: P_BG[o.payment_status] ?? "#F3F4F6",
                        color: P_COLOR[o.payment_status] ?? "#374151",
                      }}
                    >
                      {P_LABEL[o.payment_status] ?? o.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {O_LABEL[o.order_status] ?? o.order_status}
                  </td>
                  <td
                    className="px-4 py-3 text-xs whitespace-nowrap"
                    style={{ color: "var(--muted)" }}
                  >
                    {fmtDate(o.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {o.payment_status === "PENDING" && (
                        <button
                          onClick={() => action(o.public_id, "pay")}
                          disabled={loading !== null}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-white transition-opacity disabled:opacity-50 whitespace-nowrap"
                          style={{ background: "#16A34A" }}
                        >
                          {loading === `${o.public_id}:pay` ? "…" : "Confirmar Pag."}
                        </button>
                      )}
                      {o.payment_status === "PAID" && o.order_status !== "DELIVERED" && (
                        <button
                          onClick={() => action(o.public_id, "deliver")}
                          disabled={loading !== null}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
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
