"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { Order } from "@/db/repositories/orders.repository";

type Tab = "PENDING" | "AWAITING_PREP" | "READY" | "DELIVERED";
type ForwardAction = "pay" | "ready" | "deliver";
type ReverseAction = "unpay" | "unready" | "undeliver";
type Action = ForwardAction | ReverseAction;

function fmtTotal(v: string) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
function fmtItems(items: Order["items"]) {
  return items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
}

function ReverseMenu({
  publicId,
  reverseAction,
  reverseLabel,
  loading,
  onAction,
}: {
  publicId: string;
  reverseAction: ReverseAction;
  reverseLabel: string;
  loading: string | null;
  onAction: (id: string, action: Action) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading !== null}
        title="Mais opções"
        className="rounded px-2 py-1 font-bold disabled:opacity-50"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          fontSize: "1rem",
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 50,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: "180px",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => {
              setOpen(false);
              onAction(publicId, reverseAction);
            }}
            disabled={loading !== null}
            className="w-full text-left px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ color: "#DC2626", background: "transparent" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
            }
          >
            ↩ {reverseLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export function OrderTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
  const sortReadyAsc = (a: Order, b: Order) =>
    new Date(a.ready_at ?? a.created_at).getTime() - new Date(b.ready_at ?? b.created_at).getTime();
  const sortDeliveredDesc = (a: Order, b: Order) =>
    new Date(b.delivered_at ?? b.created_at).getTime() -
    new Date(a.delivered_at ?? a.created_at).getTime();

  const displayed =
    tab === "PENDING"
      ? [...pending].sort(sortAsc)
      : tab === "AWAITING_PREP"
        ? [...awaitingPrep].sort(sortPaidAsc)
        : tab === "READY"
          ? [...ready].sort(sortReadyAsc)
          : [...delivered].sort(sortDeliveredDesc);

  const forwardEndpoint: Record<ForwardAction, string> = {
    pay: "pay",
    ready: "ready",
    deliver: "deliver",
  };
  const reverseEndpoint: Record<ReverseAction, string> = {
    unpay: "unpay",
    unready: "unready",
    undeliver: "undeliver",
  };

  async function action(publicId: string, act: Action) {
    setLoading(`${publicId}:${act}`);
    const isReverse = act.startsWith("un");
    const endpoint = isReverse
      ? reverseEndpoint[act as ReverseAction]
      : forwardEndpoint[act as ForwardAction];
    try {
      const res = await fetch(`/api/admin/orders/${publicId}/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "Erro.");
        return;
      }
      const msgs: Record<Action, string> = {
        pay: `✅ ${publicId} marcado como pago.`,
        ready: `🍽️ ${publicId} pronto para retirada.`,
        deliver: `📦 ${publicId} entregue.`,
        unpay: `↩ ${publicId} revertido para pendente.`,
        unready: `↩ ${publicId} revertido para pago.`,
        undeliver: `↩ ${publicId} revertido para pronto.`,
      };
      setToast(msgs[act]);
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
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {toast}
        </div>
      )}

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
                    <div className="flex gap-1.5 items-center">
                      {/* Ações de avanço */}
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

                      {/* Menu ⋯ de reversão */}
                      {o.payment_status === "PAID" && o.order_status === "CREATED" && (
                        <ReverseMenu
                          publicId={o.public_id}
                          reverseAction="unpay"
                          reverseLabel="Reverter para Pendente"
                          loading={loading}
                          onAction={action}
                        />
                      )}
                      {o.payment_status === "PAID" && o.order_status === "READY" && (
                        <ReverseMenu
                          publicId={o.public_id}
                          reverseAction="unready"
                          reverseLabel="Reverter para Pago"
                          loading={loading}
                          onAction={action}
                        />
                      )}
                      {o.order_status === "DELIVERED" && (
                        <ReverseMenu
                          publicId={o.public_id}
                          reverseAction="undeliver"
                          reverseLabel="Reverter para Pronto"
                          loading={loading}
                          onAction={action}
                        />
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
