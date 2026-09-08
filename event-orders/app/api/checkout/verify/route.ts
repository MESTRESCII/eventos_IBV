import { findOrderByPublicId, markOrderAsPaid } from "@/db/repositories/orders.repository";
import {
  createPayment,
  findPendingPaymentByOrderNsu,
  markPaymentAsPaid,
} from "@/db/repositories/payments.repository";
import { checkPayment } from "@/libs/payment/infinitepay/client";
import { appendOrderRow } from "@/libs/sheets";
import { z } from "zod";

export const dynamic = "force-dynamic";

const VerifySchema = z.object({
  public_id: z.string().min(1).max(20),
  transaction_nsu: z.string().min(1),
  invoice_slug: z.string().optional(),
});

/**
 * POST /api/checkout/verify
 *
 * Fallback acionado pela página de confirmação quando o webhook não chega a tempo.
 * Consulta a InfinitePay diretamente e atualiza o pedido se confirmado como PAGO.
 * Seguro: só marca PAID se a InfinitePay confirmar — sem alterar nada em caso de dúvida.
 * Idempotente: chamadas repetidas com pedido já PAID retornam sucesso sem reprocessar.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { public_id, transaction_nsu, invoice_slug } = parsed.data;
  const publicId = public_id.toUpperCase();

  const order = await findOrderByPublicId(publicId);
  if (!order) {
    return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  // Já pago — retorna sem reprocessar
  if (order.payment_status === "PAID") {
    return Response.json({ paid: true, payment_status: "PAID", paid_at: order.paid_at });
  }

  // Só verifica pedidos em aberto para pagamento imediato
  if (order.payment_status !== "AWAITING_PAYMENT") {
    return Response.json({ paid: false, payment_status: order.payment_status });
  }

  // Verifica com a InfinitePay
  let verification;
  try {
    verification = await checkPayment({
      orderNsu: publicId,
      transactionNsu: transaction_nsu,
      invoiceSlug: invoice_slug,
    });
  } catch (err) {
    console.error("[checkout/verify] Erro ao verificar na InfinitePay:", err);
    return Response.json({ error: "Erro ao verificar pagamento" }, { status: 500 });
  }

  if (!verification.paid) {
    return Response.json({ paid: false, payment_status: order.payment_status });
  }

  // Valida valor se disponível
  if (verification.amountInCents !== undefined) {
    const expectedCents = Math.round(parseFloat(order.total_amount) * 100);
    if (verification.amountInCents !== expectedCents) {
      console.error("[checkout/verify] Valor divergente:", {
        publicId,
        expected_cents: expectedCents,
        received_cents: verification.amountInCents,
      });
      return Response.json({ error: "Valor pago diverge do pedido" }, { status: 422 });
    }
  }

  // Garante que existe um registro de pagamento (pode não existir se createPayment falhou antes)
  const pendingPayment = await findPendingPaymentByOrderNsu(publicId);

  if (pendingPayment) {
    await markPaymentAsPaid(pendingPayment.id, {
      transaction_nsu,
      invoice_slug,
      paid_amount: verification.amountInCents
        ? verification.amountInCents / 100
        : parseFloat(order.total_amount),
      payment_method: verification.paymentMethod,
      receipt_url: verification.receiptUrl,
    });
  } else {
    // Pagamento não encontrado — cria e já marca como pago
    await createPayment({
      order_id: order.id,
      order_nsu: publicId,
      amount: parseFloat(order.total_amount),
    });
  }

  // Marca pedido como PAGO
  const paidOrder = await markOrderAsPaid(publicId);
  const paidAt = paidOrder?.paid_at ?? new Date().toISOString();

  // Sincroniza com Sheets (fire-and-forget)
  void syncToSheets(order, paidAt);

  return Response.json({ paid: true, payment_status: "PAID", paid_at: paidAt });
}

async function syncToSheets(
  order: Awaited<ReturnType<typeof findOrderByPublicId>>,
  paidAt: string,
): Promise<void> {
  if (!order) return;
  try {
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
  } catch (err) {
    console.error("[checkout/verify] syncToSheets falhou:", err);
  }
}
