import { findOrderByPublicId } from "@/db/repositories/orders.repository";
import { createPayment } from "@/db/repositories/payments.repository";
import { createCheckout } from "@/libs/payment/infinitepay/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ public_id: string }> };

/**
 * POST /api/orders/:public_id/payment
 *
 * Inicia o checkout InfinitePay para um pedido existente.
 * Só deve ser chamado se o cliente escolher pagar imediatamente.
 * Pedidos pagos no dia do evento não precisam passar por aqui.
 */
export async function POST(_req: Request, { params }: Params) {
  const { public_id } = await params;
  const publicId = public_id.toUpperCase();

  // Busca o pedido e valida estado
  const order = await findOrderByPublicId(publicId);
  if (!order) {
    return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (order.payment_status === "PAID") {
    return Response.json({ error: "Pedido já pago" }, { status: 409 });
  }
  if (order.payment_status !== "PENDING") {
    return Response.json({ error: "Pedido em estado inválido para pagamento" }, { status: 409 });
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const webhookToken = process.env.INFINITEPAY_WEBHOOK_TOKEN;

  if (!webhookToken) {
    console.error("[payment] INFINITEPAY_WEBHOOK_TOKEN não configurado");
    return Response.json({ error: "Erro de configuração do servidor" }, { status: 500 });
  }

  // Monta itens com preços em centavos (InfinitePay exige inteiros)
  const items = order.items.map((item) => ({
    description: item.product_name,
    quantity: item.quantity,
    priceInCents: Math.round(parseFloat(item.unit_price) * 100),
  }));

  try {
    const checkout = await createCheckout({
      orderNsu: publicId,
      items,
      redirectUrl: `${baseUrl}/pedido/${publicId}/confirmacao`,
      webhookUrl: `${baseUrl}/api/webhooks/infinitepay/${webhookToken}`,
    });

    // Registra a tentativa de pagamento como PENDING
    await createPayment({
      order_id: order.id,
      order_nsu: publicId,
      amount: parseFloat(order.total_amount),
    });

    return Response.json({ checkout_url: checkout.checkoutUrl });
  } catch (err) {
    console.error("[payment] Erro ao criar checkout InfinitePay:", err);
    return Response.json({ error: "Erro ao criar checkout" }, { status: 500 });
  }
}
