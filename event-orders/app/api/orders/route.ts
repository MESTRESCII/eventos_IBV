import { getSupabaseClient } from "@/libs/supabase";
import { appendOrderRow } from "@/libs/sheets";
import { findOrderByPublicId } from "@/db/repositories/orders.repository";
import { z } from "zod";

const PICKUP_DATE = "2026-09-26";

const OrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

const CreateOrderSchema = z.object({
  customer_name: z.string().min(3).max(120),
  idempotency_key: z.string().min(1).max(200),
  items: z.array(OrderItemSchema).min(1).max(20),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { customer_name, idempotency_key, items } = parsed.data;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("create_order", {
      p_customer_name: customer_name,
      p_pickup_date: PICKUP_DATE,
      p_idempotency_key: idempotency_key,
      p_items: items,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("Estoque insuficiente")) {
        return Response.json({ error: msg }, { status: 409 });
      }
      if (msg.includes("Produto não encontrado")) {
        return Response.json({ error: msg }, { status: 404 });
      }
      console.error("[orders] RPC error:", error);
      return Response.json({ error: "Erro ao criar pedido" }, { status: 500 });
    }

    // Busca o pedido completo e sincroniza com Sheets (fire-and-forget)
    const publicId = String((data as Record<string, unknown>)?.public_id ?? "");
    void syncToSheets(publicId);

    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error("[orders] Unexpected error:", err);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}

/**
 * Busca o pedido completo no banco e envia ao Google Sheets.
 * Fire-and-forget — falhas são logadas, nunca interrompem o fluxo.
 */
async function syncToSheets(publicId: string): Promise<void> {
  if (!publicId) return;
  try {
    const order = await findOrderByPublicId(publicId);
    if (!order) {
      console.warn("[orders] syncToSheets: pedido não encontrado:", publicId);
      return;
    }

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
      paymentStatus: order.payment_status,
      orderStatus: order.order_status,
      createdAt: order.created_at,
      paidAt: order.paid_at,
    });
  } catch (err) {
    console.error("[orders] syncToSheets falhou:", err);
  }
}
