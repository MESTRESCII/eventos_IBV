import { findOrderByPublicId } from "@/db/repositories/orders.repository";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ public_id: string }> };

/**
 * GET /api/orders/:public_id
 *
 * Consultado pelo frontend após redirect_url do checkout InfinitePay.
 * Retorna o status atual do pedido — nunca confirma pagamento por si só.
 */
export async function GET(_req: Request, { params }: Params) {
  const { public_id } = await params;
  const publicId = public_id.toUpperCase();

  const order = await findOrderByPublicId(publicId);
  if (!order) {
    return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  return Response.json({
    public_id: order.public_id,
    customer_name: order.customer_name,
    total_amount: order.total_amount,
    payment_status: order.payment_status,
    order_status: order.order_status,
    paid_at: order.paid_at,
    items: order.items,
  });
}
