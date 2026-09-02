import { getSupabaseClient } from "@/libs/supabase";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
};

type Order = {
  id: string;
  public_id: string;
  customer_name: string;
  customer_email: string;
  pickup_date: string;
  total_amount: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  items: OrderItem[];
};

export async function findOrderByPublicId(publicId: string): Promise<Order | null> {
  const supabase = getSupabaseClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("public_id", publicId)
    .single();

  if (error || !order) return null;

  return order as Order;
}
