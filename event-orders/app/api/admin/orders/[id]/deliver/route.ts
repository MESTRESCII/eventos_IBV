import { markOrderAsDelivered } from "@/db/repositories/orders.repository";
import { updateOrderRow } from "@/libs/sheets";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const publicId = id.toUpperCase();

  let deliveredBy: string | undefined;
  try {
    const body = await req.json();
    deliveredBy = String(body?.delivered_by ?? "").trim() || undefined;
  } catch {
    /* sem body, tudo bem */
  }

  const order = await markOrderAsDelivered(publicId, deliveredBy);
  if (!order) {
    return Response.json({ error: "Pedido não encontrado ou já entregue." }, { status: 404 });
  }

  void updateOrderRow(publicId, {
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    paidAt: order.paid_at,
  });

  return Response.json({ ok: true, order });
}
