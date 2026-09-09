"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  quantity: number;
  product_name: string;
  subtotal: string;
};

type Props = {
  publicId: string;
  initialStatus: string;
  customerName: string;
  totalAmount: string;
  receiptUrl?: string;
  transactionNsu?: string;
  invoiceSlug?: string;
  items: Item[];
  pickupDate: string;
};

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 300_000; // 5 minutos
const REDIRECT_DELAY_MS = 3_000;

export function ConfirmacaoClient({
  publicId,
  initialStatus,
  customerName,
  totalAmount,
  receiptUrl,
  transactionNsu,
  invoiceSlug,
  items,
  pickupDate,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const isPaid = status === "PAID";
  const isProcessing = status === "AWAITING_PAYMENT";

  // Redirect automático após confirmação — contagem baseada em tempo (sem setState síncrono no body)
  useEffect(() => {
    if (!isPaid) return;

    const startedAt = Date.now();

    const countInterval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((REDIRECT_DELAY_MS - (Date.now() - startedAt)) / 1000),
      );
      setRedirectCountdown(remaining);
      if (remaining === 0) clearInterval(countInterval);
    }, 200);

    const redirectTimer = setTimeout(() => {
      router.replace("/");
    }, REDIRECT_DELAY_MS);

    return () => {
      clearInterval(countInterval);
      clearTimeout(redirectTimer);
    };
  }, [isPaid, router]);

  // Confirmação ativa: enquanto o pedido não fecha, consulta a InfinitePay a cada 2s.
  //
  // Antes a página só verificava uma vez e depois ficava relendo o banco, esperando o
  // webhook. Se o webhook falhasse, ela girava para sempre. Agora cada ciclo pergunta à
  // própria InfinitePay, então a confirmação acontece em segundos mesmo sem webhook.
  useEffect(() => {
    if (!isProcessing) return;

    let cancelled = false;
    const startedAt = Date.now();

    async function checkOnce(): Promise<boolean> {
      // Sem transaction_nsu não há como consultar a InfinitePay: só resta reler o banco,
      // que o webhook ou o backstop atualizam.
      const endpoint = transactionNsu ? "/api/checkout/verify" : `/api/orders/${publicId}`;

      try {
        const res = transactionNsu
          ? await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_id: publicId,
                transaction_nsu: transactionNsu,
                ...(invoiceSlug ? { invoice_slug: invoiceSlug } : {}),
                ...(receiptUrl ? { receipt_url: receiptUrl } : {}),
              }),
            })
          : await fetch(endpoint);

        if (!res.ok) return false;

        const data = (await res.json()) as { payment_status?: string; paid_at?: string | null };
        if (data.payment_status !== "PAID") return false;

        if (!cancelled) {
          setStatus("PAID");
          setPaidAt(data.paid_at ?? null);
        }
        return true;
      } catch {
        return false;
      }
    }

    void checkOnce();

    const interval = setInterval(() => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        clearInterval(interval);
        if (!cancelled) setTimedOut(true);
        return;
      }
      void checkOnce().then((done) => {
        if (done) clearInterval(interval);
      });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicId, transactionNsu, invoiceSlug, receiptUrl, isProcessing]);

  const formattedPickupDate = new Date(pickupDate).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });

  const formattedTotal = `R$ ${Number(totalAmount).toFixed(2).replace(".", ",")}`;

  return (
    <div
      className="rounded-xl border p-6 shadow-sm"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      {/* Código do pedido */}
      <div className="mb-5 pb-5 border-b" style={{ borderColor: "var(--border)" }}>
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: "var(--muted)" }}
        >
          Pedido
        </p>
        <p
          className="text-4xl font-bold tracking-widest tabular-nums"
          style={{ color: "var(--primary)" }}
        >
          {publicId}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {customerName}
        </p>
      </div>

      {/* Itens */}
      <ul className="flex flex-col gap-2 mb-4">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span>
              {item.quantity}× {item.product_name}
            </span>
            <span className="font-mono tabular-nums">
              R$ {Number(item.subtotal).toFixed(2).replace(".", ",")}
            </span>
          </li>
        ))}
      </ul>

      <div
        className="border-t pt-4 flex justify-between font-semibold text-sm mb-5"
        style={{ borderColor: "var(--border)" }}
      >
        <span>Total</span>
        <span className="font-mono tabular-nums" style={{ color: "var(--primary)" }}>
          {formattedTotal}
        </span>
      </div>

      {/* Status */}
      {isPaid ? (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4 mb-4">
          <p className="text-sm font-semibold text-green-800 mb-1">✅ Pagamento confirmado!</p>
          {paidAt && (
            <p className="text-xs text-green-700 mb-2">
              Confirmado em{" "}
              {new Date(paidAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          )}
          {redirectCountdown !== null && redirectCountdown > 0 && (
            <p className="text-xs text-green-600">
              Redirecionando para a página do evento em {redirectCountdown}s…
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-lg border px-4 py-4 mb-4"
          style={{ background: "#FEFBF0", borderColor: "#D4B86A" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-3 h-3 rounded-full animate-pulse"
              style={{ background: "#D4B86A" }}
            />
            <p className="text-sm font-semibold" style={{ color: "#7A5F10" }}>
              {timedOut ? "Aguardando confirmação…" : "Verificando pagamento…"}
            </p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#8B7040" }}>
            {timedOut
              ? "A confirmação está demorando mais que o normal. Se o pagamento já foi feito, ele será confirmado automaticamente em instantes — guarde o código do pedido."
              : "Confirmando com a InfinitePay. Esta página atualiza automaticamente."}
          </p>
        </div>
      )}

      {/* Link para comprovante InfinitePay */}
      {receiptUrl && (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm underline underline-offset-2 mb-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--primary)" }}
        >
          Ver comprovante InfinitePay
        </a>
      )}

      <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
        Retirada: {formattedPickupDate}
      </p>
    </div>
  );
}
