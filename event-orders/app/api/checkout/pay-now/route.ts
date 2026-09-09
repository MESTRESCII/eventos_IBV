import { getSupabaseClient } from "@/libs/supabase";
import { findOrderByPublicId } from "@/db/repositories/orders.repository";
import { createPayment } from "@/db/repositories/payments.repository";
import { createCheckout } from "@/libs/payment/infinitepay/client";
import { getBaseUrl } from "@/libs/env";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PICKUP_DATE = "2026-09-26";

const OrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

const PayNowSchema = z.object({
  customer_name: z.string().min(3).max(120),
  idempotency_key: z.string().min(1).max(200),
  items: z.array(OrderItemSchema).min(1).max(20),
});

/**
 * POST /api/checkout/pay-now
 *
 * Cria pedido com status AWAITING_PAYMENT e inicia o checkout InfinitePay atomicamente.
 * O pedido só migra para PAID via webhook, após confirmação real do pagamento.
 *
 * Pedidos AWAITING_PAYMENT NÃO aparecem no painel admin nem no Google Sheets — só
 * entram no sistema quando o pagamento é efetivamente confirmado.
 */
export async function POST(request: Request) {
  const baseUrl = getBaseUrl();
  const webhookToken = process.env.INFINITEPAY_WEBHOOK_TOKEN;

  if (!webhookToken) {
    console.error("[checkout/pay-now] INFINITEPAY_WEBHOOK_TOKEN não configurado");
    return Response.json({ error: "Erro de configuração do servidor" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = PayNowSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { customer_name, idempotency_key, items } = parsed.data;

  const supabase = getSupabaseClient();

  // Cria pedido como AWAITING_PAYMENT (reserva estoque atomicamente, mas invisível no admin)
  let publicId: string;
  let orderId: string;
  let totalAmount: number;

  try {
    const { data, error } = await supabase.rpc("create_order", {
      p_customer_name: customer_name,
      p_pickup_date: PICKUP_DATE,
      p_idempotency_key: idempotency_key,
      p_items: items,
      p_payment_status: "AWAITING_PAYMENT",
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("Estoque insuficiente")) {
        return Response.json({ error: msg }, { status: 409 });
      }
      if (msg.includes("Produto não encontrado")) {
        return Response.json({ error: msg }, { status: 404 });
      }
      console.error("[checkout/pay-now] RPC error:", error);
      return Response.json({ error: "Erro ao criar pedido" }, { status: 500 });
    }

    const result = data as Record<string, unknown>;
    publicId = String(result.public_id ?? "");
    orderId = String(result.order_id ?? "");
    totalAmount = Number(result.total_amount ?? 0);
  } catch (err) {
    console.error("[checkout/pay-now] Erro ao criar pedido:", err);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }

  // Busca itens para montar o checkout InfinitePay
  const order = await findOrderByPublicId(publicId);
  if (!order) {
    console.error("[checkout/pay-now] Pedido não encontrado após criação:", publicId);
    return Response.json({ error: "Erro ao localizar pedido criado" }, { status: 500 });
  }

  const checkoutItems = order.items.map((item) => ({
    description: item.product_name,
    quantity: item.quantity,
    priceInCents: Math.round(parseFloat(item.unit_price) * 100),
  }));

  try {
    const checkout = await createCheckout({
      orderNsu: publicId,
      items: checkoutItems,
      redirectUrl: `${baseUrl}/pedido/${publicId}/confirmacao`,
      webhookUrl: `${baseUrl}/api/webhooks/infinitepay/${webhookToken}`,
    });

    // Registra a tentativa de pagamento — atualizada pelo webhook quando confirmada
    await createPayment({
      order_id: orderId,
      order_nsu: publicId,
      amount: totalAmount,
    });

    return Response.json({ checkout_url: checkout.checkoutUrl, public_id: publicId });
  } catch (err) {
    console.error("[checkout/pay-now] Erro ao criar checkout InfinitePay:", err);
    return Response.json({ error: "Erro ao criar checkout" }, { status: 500 });
  }
}
