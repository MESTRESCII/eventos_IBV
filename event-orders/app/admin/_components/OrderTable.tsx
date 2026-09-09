"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Order } from "@/db/repositories/orders.repository";

type Tab = "PENDING" | "AWAITING_PREP" | "READY" | "DELIVERED";
type ForwardAction = "pay" | "ready" | "deliver";
type ReverseAction = "unpay" | "unready" | "undeliver";
type Action = ForwardAction | ReverseAction | "cancel";

const CANCEL_CONFIRM_WORD = "CANCELAR";

function fmtTotal(v: string) {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
function fmtItems(items: Order["items"]) {
  return items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
}

/**
 * Menu "⋯" genérico para ações secundárias (reverter fase, cancelar pedido).
 *
 * O dropdown é renderizado via portal em document.body com position: fixed.
 * Isso evita ficar preso dentro do <div overflow-x-auto> que envolve a tabela —
 * caso contrário, o dropdown "empurra" a altura do container e o navegador
 * passa a exibir um scroller vertical na tabela inteira (CSS: overflow-x auto
 * força overflow-y para auto também).
 */
function ActionMenu({
  items,
  loading,
}: {
  items: { key: string; label: string; onSelect: () => void }[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        disabled={loading}
        title="Mais opções"
        className="rounded px-2 py-1 font-bold disabled:opacity-50 shrink-0"
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
      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              right: menuPos.right,
              zIndex: 50,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: "180px",
              overflow: "hidden",
            }}
          >
            {items.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                disabled={loading}
                className="w-full text-left px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                style={{ color: "#DC2626", background: "transparent" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                }
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Modal de confirmação dupla para cancelar pedido — exige digitar "CANCELAR". */
function CancelConfirmDialog({
  publicId,
  onConfirm,
  onClose,
}: {
  publicId: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const confirmed = text.trim().toUpperCase() === CANCEL_CONFIRM_WORD;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border p-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="text-sm font-bold mb-1.5">Cancelar pedido {publicId}?</p>
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Essa ação não pode ser desfeita. O estoque dos itens será devolvido. Para confirmar,
          digite <span className="font-mono font-bold">{CANCEL_CONFIRM_WORD}</span> abaixo.
        </p>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && confirmed) onConfirm();
          }}
          placeholder={CANCEL_CONFIRM_WORD}
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono mb-4 focus:outline-none focus:ring-2"
          style={{ borderColor: "var(--border)" }}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: "#DC2626" }}
          >
            Cancelar pedido
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

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
  const reverseEndpoint: Record<ReverseAction | "cancel", string> = {
    unpay: "unpay",
    unready: "unready",
    undeliver: "undeliver",
    cancel: "cancel",
  };

  async function action(publicId: string, act: Action) {
    setLoading(`${publicId}:${act}`);
    const isForward = act === "pay" || act === "ready" || act === "deliver";
    const endpoint = isForward
      ? forwardEndpoint[act as ForwardAction]
      : reverseEndpoint[act as ReverseAction | "cancel"];
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
        cancel: `🗑 ${publicId} cancelado.`,
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

      {cancelTarget && (
        <CancelConfirmDialog
          publicId={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => {
            const id = cancelTarget;
            setCancelTarget(null);
            void action(id, "cancel");
          }}
        />
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
                    className="text-left px-2.5 py-2 sm:px-3 sm:py-2.5 font-semibold whitespace-nowrap"
                    style={{ color: "var(--muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((o, i) => {
                const loadingThisRow = loading !== null && loading.startsWith(`${o.public_id}:`);
                const menuItems: { key: string; label: string; onSelect: () => void }[] = [];
                if (o.payment_status === "PENDING") {
                  menuItems.push({
                    key: "cancel",
                    label: "🗑 Cancelar pedido",
                    onSelect: () => setCancelTarget(o.public_id),
                  });
                }
                if (o.payment_status === "PAID" && o.order_status === "CREATED") {
                  menuItems.push({
                    key: "unpay",
                    label: "↩ Reverter para Pendente",
                    onSelect: () => action(o.public_id, "unpay"),
                  });
                }
                if (o.payment_status === "PAID" && o.order_status === "READY") {
                  menuItems.push({
                    key: "unready",
                    label: "↩ Reverter para Pago",
                    onSelect: () => action(o.public_id, "unready"),
                  });
                }
                if (o.order_status === "DELIVERED") {
                  menuItems.push({
                    key: "undeliver",
                    label: "↩ Reverter para Pronto",
                    onSelect: () => action(o.public_id, "undeliver"),
                  });
                }

                return (
                  <tr
                    key={o.id}
                    style={{
                      background: i % 2 === 0 ? "var(--background)" : "var(--card)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <td
                      className="px-2.5 py-2 sm:px-3 font-bold font-mono tracking-widest whitespace-nowrap"
                      style={{ color: "var(--primary)" }}
                    >
                      {o.public_id}
                    </td>
                    <td className="px-2.5 py-2 sm:px-3 whitespace-nowrap">{o.customer_name}</td>
                    <td
                      className="px-2.5 py-2 sm:px-3 max-w-[12rem] truncate"
                      style={{ color: "var(--muted)" }}
                      title={fmtItems(o.items)}
                    >
                      {fmtItems(o.items)}
                    </td>
                    <td className="px-2.5 py-2 sm:px-3 font-mono whitespace-nowrap">
                      {fmtTotal(o.total_amount)}
                    </td>
                    <td className="px-2.5 py-2 sm:px-3">
                      <div className="flex flex-nowrap gap-1.5 items-center">
                        {o.payment_status === "PENDING" && (
                          <button
                            onClick={() => action(o.public_id, "pay")}
                            disabled={loading !== null}
                            className="rounded px-2 py-1 font-semibold text-white disabled:opacity-50 whitespace-nowrap shrink-0"
                            style={{ background: "#16A34A" }}
                          >
                            {loading === `${o.public_id}:pay` ? "…" : "Pagar"}
                          </button>
                        )}
                        {o.payment_status === "PAID" && o.order_status === "CREATED" && (
                          <button
                            onClick={() => action(o.public_id, "ready")}
                            disabled={loading !== null}
                            className="rounded px-2 py-1 font-semibold text-white disabled:opacity-50 whitespace-nowrap shrink-0"
                            style={{ background: "#D97706" }}
                          >
                            {loading === `${o.public_id}:ready` ? "…" : "Pronto"}
                          </button>
                        )}
                        {o.payment_status === "PAID" && o.order_status === "READY" && (
                          <button
                            onClick={() => action(o.public_id, "deliver")}
                            disabled={loading !== null}
                            className="rounded px-2 py-1 font-semibold text-white disabled:opacity-50 whitespace-nowrap shrink-0"
                            style={{ background: "var(--primary)" }}
                          >
                            {loading === `${o.public_id}:deliver` ? "…" : "Entregar"}
                          </button>
                        )}

                        <ActionMenu items={menuItems} loading={loadingThisRow} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
