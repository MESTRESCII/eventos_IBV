import { confirmPayment } from "@/libs/payment/confirm-payment";
import { z } from "zod";

export const dynamic = "force-dynamic";

const VerifySchema = z.object({
  public_id: z.string().min(1).max(20),
  transaction_nsu: z.string().min(1),
  invoice_slug: z.string().optional(),
  // .catch(undefined): receipt_url vem de um query param que o cliente controla.
  // Um valor malformado deve ser descartado, nunca derrubar a confirmação com 400.
  receipt_url: z.string().url().optional().catch(undefined),
});

/**
 * POST /api/checkout/verify
 *
 * Chamado pela página de confirmação assim que o cliente volta do checkout, e repetido
 * enquanto o pedido não confirma. É o caminho rápido: não espera o webhook chegar.
 * Só marca PAGO se a InfinitePay confirmar — nunca com base no redirect, que é forjável.
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

  const { public_id, transaction_nsu, invoice_slug, receipt_url } = parsed.data;
  const publicId = public_id.toUpperCase();

  const result = await confirmPayment({
    publicId,
    transactionNsu: transaction_nsu,
    invoiceSlug: invoice_slug,
    receiptUrl: receipt_url,
    source: "redirect",
  });

  switch (result.outcome) {
    case "confirmed":
      return Response.json({ paid: true, payment_status: "PAID", paid_at: result.paidAt });
    case "already_paid":
      return Response.json({ paid: true, payment_status: "PAID", paid_at: result.paidAt });
    case "not_paid":
      return Response.json({ paid: false, payment_status: "AWAITING_PAYMENT" });
    case "order_not_found":
      return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
    case "not_confirmable":
      return Response.json({ paid: false, payment_status: result.paymentStatus });
    case "amount_mismatch":
      return Response.json({ error: "Valor pago diverge do pedido" }, { status: 422 });
    case "provider_error":
      return Response.json({ error: "Erro ao verificar pagamento" }, { status: 500 });
  }
}
