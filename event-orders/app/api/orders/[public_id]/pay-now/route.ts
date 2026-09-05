import { markOrderAsPaid } from "@/db/repositories/orders.repository";
import { updateOrderRow } from "@/libs/sheets";

type Params = { params: Promise<{ public_id: string }> };

/**
 * POST /api/orders/[public_id]/pay-now
 *
 * Simula pagamento imediato pelo cliente (Pix/cartão — integração futura).
 * Por ora apenas marca o pedido como PAGO, permitindo testar o fluxo completo.
 */
export async function POST(_req: Request, { params }: Params) {
  const { public_id } = await params;
  const publicId = public_id.toUpperCase();

  const order = await markOrderAsPaid(publicId);
  if (!order)
    return Response.json({ error: "Pedido não encontrado ou já processado." }, { status: 404 });

  void updateOrderRow(publicId, {
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    paidAt: order.paid_at,
  });

  return Response.json({ ok: true, order });
}
