import { findOrderByPublicId, markOrderAsPaid } from "@/db/repositories/orders.repository";
import {
  findPaymentByTransactionNsu,
  findPendingPaymentByOrderNsu,
  markPaymentAsPaid,
} from "@/db/repositories/payments.repository";
import { checkPayment } from "@/libs/payment/infinitepay/client";
import { appendOrderRow, updateOrderRow } from "@/libs/sheets";
import type { WebhookPayload } from "@/libs/payment/infinitepay/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/webhooks/infinitepay/:token
 *
 * Webhook = campainha. Nunca confirma pagamento sozinho.
 * Fluxo: recebe notificação → chama payment_check → valida → marca PAID.
 *
 * Após confirmação, sincroniza com Google Sheets:
 * - Pedido era AWAITING_PAYMENT → append (primeira vez no Sheets)
 * - Pedido era PENDING          → update (já existe no Sheets como pendente)
 *
 * Idempotente: mesmo webhook recebido duas vezes não processa duas vezes.
 * A URL com token aleatório é o único controle de acesso (InfinitePay não assina webhooks).
 */
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;

  const expectedToken = process.env.INFINITEPAY_WEBHOOK_TOKEN;
  if (!expectedToken || token !== expectedToken) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { order_nsu, transaction_nsu, invoice_slug } = payload;

  if (!order_nsu || !transaction_nsu) {
    return Response.json(
      { error: "order_nsu e transaction_nsu são obrigatórios" },
      { status: 400 },
    );
  }

  // Idempotência: transaction_nsu já processado → 200 sem reprocessar
  const existingPayment = await findPaymentByTransactionNsu(transaction_nsu);
  if (existingPayment?.status === "PAID") {
    return Response.json({ ok: true, idempotent: true });
  }

  // Valida que o pedido existe
  const order = await findOrderByPublicId(order_nsu);
  if (!order) {
    return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  // Pedido já pago (pode ter sido pago manualmente pelo admin)
  if (order.payment_status === "PAID") {
    return Response.json({ ok: true, idempotent: true });
  }

  // Captura o status antes de alterar — necessário para decidir como sincronizar no Sheets
  const previousPaymentStatus = order.payment_status;

  // Webhook = campainha. Verificar com a InfinitePay antes de confirmar.
  let verification;
  try {
    verification = await checkPayment({
      orderNsu: order_nsu,
      transactionNsu: transaction_nsu,
      invoiceSlug: invoice_slug,
    });
  } catch (err) {
    console.error("[webhook] Erro ao verificar pagamento na InfinitePay:", err);
    return Response.json({ error: "Erro ao verificar pagamento" }, { status: 500 });
  }

  if (!verification.paid) {
    console.warn("[webhook] Pagamento não confirmado pela InfinitePay:", {
      order_nsu,
      transaction_nsu,
    });
    return Response.json({ ok: false, paid: false });
  }

  // Valida valor pago (se InfinitePay retornar o campo)
  if (verification.amountInCents !== undefined) {
    const expectedCents = Math.round(parseFloat(order.total_amount) * 100);
    if (verification.amountInCents !== expectedCents) {
      console.error("[webhook] Valor divergente:", {
        order_nsu,
        expected_cents: expectedCents,
        received_cents: verification.amountInCents,
      });
      return Response.json({ error: "Valor pago diverge do pedido" }, { status: 422 });
    }
  }

  // Busca o registro de pagamento PENDING para atualizar
  const pendingPayment = await findPendingPaymentByOrderNsu(order_nsu);

  if (pendingPayment) {
    await markPaymentAsPaid(pendingPayment.id, {
      transaction_nsu,
      invoice_slug: invoice_slug ?? undefined,
      paid_amount: verification.amountInCents
        ? verification.amountInCents / 100
        : parseFloat(order.total_amount),
      payment_method: verification.paymentMethod,
      receipt_url: verification.receiptUrl,
    });
  }

  // Marca o pedido como PAGO
  const paidOrder = await markOrderAsPaid(order.public_id);
  const paidAt = paidOrder?.paid_at ?? new Date().toISOString();

  // Sincroniza com Google Sheets (fire-and-forget)
  void syncPaidOrderToSheets(order, previousPaymentStatus, paidAt);

  return Response.json({ ok: true });
}

/**
 * Sincroniza o pedido pago no Google Sheets.
 * - AWAITING_PAYMENT → append (nunca estava no Sheets)
 * - PENDING          → update (já existe como pendente)
 */
async function syncPaidOrderToSheets(
  order: Awaited<ReturnType<typeof findOrderByPublicId>>,
  previousPaymentStatus: string,
  paidAt: string,
): Promise<void> {
  if (!order) return;

  try {
    if (previousPaymentStatus === "AWAITING_PAYMENT") {
      // Primeira vez que este pedido entra no Sheets — adiciona linha como PAGO
      const itemsSummary = order.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ");

      const total = parseFloat(order.total_amount).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      await appendOrderRow({
        publicId: order.public_id,
        customerName: order.customer_name,
        itemsSummary,
        total,
        paymentStatus: "PAID",
        orderStatus: order.order_status,
        createdAt: order.created_at,
        paidAt,
      });
    } else {
      // Pedido já existia no Sheets como PENDING — atualiza o status
      await updateOrderRow(order.public_id, {
        paymentStatus: "PAID",
        orderStatus: order.order_status,
        paidAt,
      });
    }
  } catch (err) {
    console.error("[webhook] syncPaidOrderToSheets falhou:", err);
  }
}
