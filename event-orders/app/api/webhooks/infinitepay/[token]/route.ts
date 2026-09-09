import { findPaymentByTransactionNsu } from "@/db/repositories/payments.repository";
import { confirmPayment } from "@/libs/payment/confirm-payment";
import type { WebhookPayload } from "@/libs/payment/infinitepay/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/webhooks/infinitepay/:token
 *
 * Webhook = campainha, nunca prova de pagamento. Toda confirmação passa por
 * confirmPayment(), que consulta a InfinitePay antes de marcar o pedido como PAGO.
 *
 * A InfinitePay não assina os webhooks: o token aleatório no path é o controle de acesso.
 * Idempotente — o mesmo transaction_nsu chegando duas vezes não reprocessa.
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

  const { order_nsu, transaction_nsu, invoice_slug, receipt_url } = payload;

  if (!order_nsu || !transaction_nsu) {
    return Response.json(
      { error: "order_nsu e transaction_nsu são obrigatórios" },
      { status: 400 },
    );
  }

  // Idempotência antes de qualquer trabalho.
  const existingPayment = await findPaymentByTransactionNsu(transaction_nsu);
  if (existingPayment?.status === "PAID") {
    return Response.json({ success: true, idempotent: true });
  }

  const result = await confirmPayment({
    publicId: order_nsu.toUpperCase(),
    transactionNsu: transaction_nsu,
    invoiceSlug: invoice_slug,
    receiptUrl: receipt_url,
    source: "webhook",
  });

  switch (result.outcome) {
    case "confirmed":
    case "already_paid":
      return Response.json({ success: true });

    // Pedido inexistente → 400 faz a InfinitePay reenviar. Útil se o webhook chegar
    // antes de o pedido terminar de ser gravado.
    case "order_not_found":
      return Response.json({ success: false, message: "Pedido não encontrado" }, { status: 400 });

    // Ainda não pago ou erro na consulta: respondemos 400 para provocar o reenvio.
    // O backstop também cobre este caso.
    case "not_paid":
      return Response.json(
        { success: false, message: "Pagamento não confirmado pela InfinitePay" },
        { status: 400 },
      );
    case "provider_error":
      return Response.json(
        { success: false, message: "Falha ao verificar com a InfinitePay" },
        { status: 400 },
      );

    // Casos definitivos: reenviar não muda nada, então respondemos 200.
    case "not_confirmable":
      return Response.json({ success: true, ignored: result.paymentStatus });
    case "amount_mismatch":
      return Response.json({ success: true, ignored: "amount_mismatch" });
  }
}
