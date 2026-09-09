import { findOrderByPublicId, markOrderAsPaid } from "@/db/repositories/orders.repository";
import {
  createPayment,
  findPendingPaymentByOrderNsu,
  markPaymentAsPaid,
  recordPaymentAttempt,
} from "@/db/repositories/payments.repository";
import { checkPayment } from "@/libs/payment/infinitepay/client";
import { appendOrderRow, updateOrderRow } from "@/libs/sheets";

/**
 * Tolerância para MENOS no valor pago, em centavos.
 * paid_amount pode vir MAIOR que amount (taxa repassada) — isso é sempre aceito.
 * Só recusamos pagamento a menor, e ainda assim com folga de arredondamento.
 */
const UNDERPAYMENT_TOLERANCE_CENTS = 2;

export type ConfirmSource = "webhook" | "redirect" | "backstop" | "cli";

export type ConfirmPaymentInput = {
  publicId: string;
  transactionNsu: string;
  invoiceSlug?: string;
  /** Só o webhook e o redirect entregam a URL do comprovante; payment_check não retorna. */
  receiptUrl?: string;
  source: ConfirmSource;
};

export type ConfirmPaymentResult =
  | { outcome: "confirmed"; paidAt: string }
  | { outcome: "already_paid"; paidAt: string | null }
  | { outcome: "not_paid" }
  | { outcome: "order_not_found" }
  | { outcome: "not_confirmable"; paymentStatus: string }
  | { outcome: "amount_mismatch"; expectedCents: number; paidCents: number }
  | { outcome: "provider_error"; message: string };

/**
 * Confirma um pagamento com a InfinitePay e, só então, marca o pedido como PAGO.
 *
 * Fonte única de verdade do fluxo de confirmação — usada pelo webhook, pela página de
 * confirmação, pelo backstop automático e pelo script de reconciliação. Nenhum desses
 * caminhos decide sozinho: todos passam por payment_check.
 *
 * Idempotente: pedido já PAGO retorna `already_paid` sem reprocessar.
 */
export async function confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
  const { publicId, transactionNsu, invoiceSlug, receiptUrl, source } = input;

  const order = await findOrderByPublicId(publicId);
  if (!order) return { outcome: "order_not_found" };

  if (order.payment_status === "PAID") {
    return { outcome: "already_paid", paidAt: order.paid_at };
  }

  // Só pedidos aguardando pagamento imediato entram neste fluxo.
  if (order.payment_status !== "AWAITING_PAYMENT" && order.payment_status !== "PENDING") {
    return { outcome: "not_confirmable", paymentStatus: order.payment_status };
  }

  const previousPaymentStatus = order.payment_status;

  // Garante um registro de pagamento e grava os identificadores ANTES de verificar,
  // para que o backstop consiga reconciliar mesmo se a verificação falhar agora.
  let payment = await findPendingPaymentByOrderNsu(publicId);
  if (!payment) {
    payment = await createPayment({
      order_id: order.id,
      order_nsu: publicId,
      amount: parseFloat(order.total_amount),
    });
  }
  if (payment) {
    await recordPaymentAttempt(payment.id, {
      transaction_nsu: transactionNsu,
      invoice_slug: invoiceSlug,
      receipt_url: receiptUrl,
    });
  }

  // Fonte autoritativa.
  let verification;
  try {
    verification = await checkPayment({
      orderNsu: publicId,
      transactionNsu,
      invoiceSlug,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[confirm:${source}] payment_check falhou para ${publicId}:`, message);
    return { outcome: "provider_error", message };
  }

  if (!verification.success || !verification.paid) {
    return { outcome: "not_paid" };
  }

  // Validação de valor: aceita pagamento a maior (taxa repassada), recusa a menor.
  const expectedCents = Math.round(parseFloat(order.total_amount) * 100);
  const paidCents = verification.paidAmountInCents ?? verification.amountInCents;

  if (paidCents !== undefined && paidCents < expectedCents - UNDERPAYMENT_TOLERANCE_CENTS) {
    console.error(`[confirm:${source}] Valor pago a menor em ${publicId}:`, {
      expectedCents,
      paidCents,
    });
    return { outcome: "amount_mismatch", expectedCents, paidCents };
  }

  if (payment) {
    await markPaymentAsPaid(payment.id, {
      transaction_nsu: transactionNsu,
      invoice_slug: invoiceSlug,
      paid_amount: (paidCents ?? expectedCents) / 100,
      payment_method: verification.paymentMethod,
      receipt_url: receiptUrl,
    });
  }

  const paidOrder = await markOrderAsPaid(publicId);
  const paidAt = paidOrder?.paid_at ?? new Date().toISOString();

  console.log(`[confirm:${source}] Pedido ${publicId} confirmado como PAGO.`);

  // Sheets é acessório: nunca deve derrubar a confirmação.
  void syncToSheets(order, previousPaymentStatus, paidAt);

  return { outcome: "confirmed", paidAt };
}

/**
 * Reflete o pedido pago no Google Sheets.
 * - AWAITING_PAYMENT → append (nunca esteve na planilha)
 * - PENDING          → update (já está lá como pendente)
 */
async function syncToSheets(
  order: NonNullable<Awaited<ReturnType<typeof findOrderByPublicId>>>,
  previousPaymentStatus: string,
  paidAt: string,
): Promise<void> {
  try {
    if (previousPaymentStatus === "AWAITING_PAYMENT") {
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
      await updateOrderRow(order.public_id, {
        paymentStatus: "PAID",
        orderStatus: order.order_status,
        paidAt,
      });
    }
  } catch (err) {
    console.error("[confirm] Sincronização com Sheets falhou:", err);
  }
}
