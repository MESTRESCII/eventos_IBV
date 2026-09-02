import { getSupabaseClient } from "@/libs/supabase";
import { z } from "zod";

const OrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

const CreateOrderSchema = z.object({
  customer_name: z.string().min(3).max(120),
  customer_email: z.string().email(),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
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

  const { customer_name, customer_email, pickup_date, idempotency_key, items } = parsed.data;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("create_order", {
      p_customer_name: customer_name,
      p_customer_email: customer_email,
      p_pickup_date: pickup_date,
      p_idempotency_key: idempotency_key,
      p_items: items,
    });

    if (error) {
      // Erros de negócio vindos do Postgres (estoque, produto não encontrado)
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

    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error("[orders] Unexpected error:", err);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
