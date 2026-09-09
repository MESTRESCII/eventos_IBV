import { cancelOrder } from "@/db/repositories/orders.repository";
import { updateOrderRow } from "@/libs/sheets";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const publicId = id.toUpperCase();

  const order = await cancelOrder(publicId);
  if (!order) {
    return Response.json(
      { error: "Pedido não encontrado ou não está mais pendente." },
      { status: 404 },
    );
  }

  // Atualiza Sheets de forma não-bloqueante
  void updateOrderRow(publicId, {
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
  });

  return Response.json({ ok: true, order });
}
