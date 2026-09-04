import { getSupabaseClient } from "@/libs/supabase";

export type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
};

export type Order = {
  id: string;
  public_id: string;
  customer_name: string;
  customer_email: string | null;
  pickup_date: string;
  total_amount: string;
  payment_status: string;
  order_status: string;
  payment_id: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  created_at: string;
  items: OrderItem[];
};

export async function findOrderByPublicId(publicId: string): Promise<Order | null> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("public_id", publicId)
    .single();
  if (error || !data) return null;
  return data as Order;
}

/** Lista todos os pedidos para o painel admin (mais recentes primeiro). */
export async function listAllOrders(): Promise<Order[]> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .select("*, items:order_items(*)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Order[];
}

/** Lista pedidos PAGOS aguardando preparo (na cozinha). Ordem de chegada. */
export async function listPaidAwaitingPrep(): Promise<Order[]> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("payment_status", "PAID")
    .eq("order_status", "CREATED")
    .order("paid_at", { ascending: true });
  if (error || !data) return [];
  return data as Order[];
}

/** Lista pedidos PRONTOS para retirada — exibidos no telão. */
export async function listPaidPendingDelivery(): Promise<Order[]> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("payment_status", "PAID")
    .eq("order_status", "READY")
    .order("paid_at", { ascending: true });
  if (error || !data) return [];
  return data as Order[];
}

/** Marca pedido como PAGO (pagamento confirmado; aguarda preparo). */
export async function markOrderAsPaid(publicId: string): Promise<Order | null> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .update({
      payment_status: "PAID",
      paid_at: new Date().toISOString(),
    })
    .eq("public_id", publicId)
    .eq("payment_status", "PENDING")
    .select("*, items:order_items(*)")
    .single();
  if (error || !data) return null;
  return data as Order;
}

/** Marca pedido como PRONTO para retirada. */
export async function markOrderAsReady(publicId: string): Promise<Order | null> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .update({ order_status: "READY" })
    .eq("public_id", publicId)
    .eq("payment_status", "PAID")
    .eq("order_status", "CREATED")
    .select("*, items:order_items(*)")
    .single();
  if (error || !data) return null;
  return data as Order;
}

/** Marca pedido como ENTREGUE. Retorna o pedido atualizado ou null. */
export async function markOrderAsDelivered(
  publicId: string,
  deliveredBy?: string,
): Promise<Order | null> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .update({
      order_status: "DELIVERED",
      delivered_at: new Date().toISOString(),
      ...(deliveredBy ? { delivered_by: deliveredBy } : {}),
    })
    .eq("public_id", publicId)
    .select("*, items:order_items(*)")
    .single();
  if (error || !data) return null;
  return data as Order;
}
