import { listReconcilablePayments } from "@/db/repositories/payments.repository";
import { confirmPayment } from "@/libs/payment/confirm-payment";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/** Teto por execução: mantém a resposta rápida e o custo previsível. */
const MAX_PER_RUN = 25;

/**
 * GET|POST /api/cron/reconcile/:token
 *
 * Rede de segurança automática. Varre pagamentos PENDING que já têm transaction_nsu
 * e refaz o payment_check na InfinitePay — destravando qualquer pedido cujo webhook
 * tenha se perdido, sem nenhuma intervenção manual.
 *
 * Idempotente e seguro de rodar a cada minuto: pedidos já PAGOS são ignorados e
 * nada é marcado como pago sem confirmação da InfinitePay.
 *
 * Protegido pelo mesmo token do webhook, no path — para ser acionável por qualquer
 * agendador HTTP (Cloudflare Cron Trigger, GitHub Actions, cron-job.org).
 */
async function handler(_req: Request, { params }: Params) {
  const { token } = await params;

  const expectedToken = process.env.INFINITEPAY_WEBHOOK_TOKEN;
  if (!expectedToken || token !== expectedToken) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const pending = await listReconcilablePayments(MAX_PER_RUN);

  let confirmed = 0;
  let stillPending = 0;
  let failed = 0;
  const confirmedOrders: string[] = [];

  for (const payment of pending) {
    if (!payment.transaction_nsu) continue;

    const result = await confirmPayment({
      publicId: payment.order_nsu,
      transactionNsu: payment.transaction_nsu,
      invoiceSlug: payment.invoice_slug ?? undefined,
      receiptUrl: payment.receipt_url ?? undefined,
      source: "backstop",
    });

    if (result.outcome === "confirmed") {
      confirmed++;
      confirmedOrders.push(payment.order_nsu);
    } else if (result.outcome === "provider_error") {
      failed++;
    } else if (result.outcome === "not_paid") {
      stillPending++;
    }
  }

  return Response.json({
    scanned: pending.length,
    confirmed,
    still_pending: stillPending,
    failed,
    confirmed_orders: confirmedOrders,
  });
}

export const GET = handler;
export const POST = handler;
