import { markOrderAsReady } from "@/db/repositories/orders.repository";
import { updateOrderRow } from "@/libs/sheets";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const publicId = id.toUpperCase();
  const order = await markOrderAsReady(publicId);
  if (!order)
    return Response.json({ error: "Pedido não encontrado ou já processado." }, { status: 404 });
  void updateOrderRow(publicId, {
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    paidAt: order.paid_at,
  });
  return Response.json({ ok: true, order });
}
