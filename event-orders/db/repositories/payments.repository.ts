import { getSupabaseClient } from "@/libs/supabase";

export type Payment = {
  id: string;
  order_id: string;
  provider: string;
  order_nsu: string;
  transaction_nsu: string | null;
  invoice_slug: string | null;
  amount: string;
  paid_amount: string | null;
  payment_method: string | null;
  status: string;
  receipt_url: string | null;
  created_at: string;
  paid_at: string | null;
};

export type CreatePaymentData = {
  order_id: string;
  order_nsu: string;
  /** Valor em reais (ex.: 10.50) */
  amount: number;
};

/** Registra uma tentativa de checkout como PENDING. */
export async function createPayment(data: CreatePaymentData): Promise<Payment | null> {
  const { data: payment, error } = await getSupabaseClient()
    .from("payments")
    .insert({
      order_id: data.order_id,
      provider: "infinitepay",
      order_nsu: data.order_nsu,
      amount: data.amount,
      status: "PENDING",
    })
    .select()
    .single();

  if (error || !payment) return null;
  return payment as Payment;
}

/** Busca pagamento por transaction_nsu — usado para checagem de idempotência no webhook. */
export async function findPaymentByTransactionNsu(transactionNsu: string): Promise<Payment | null> {
  const { data, error } = await getSupabaseClient()
    .from("payments")
    .select()
    .eq("transaction_nsu", transactionNsu)
    .maybeSingle();

  if (error || !data) return null;
  return data as Payment;
}

/** Busca o pagamento PENDING mais recente de um pedido (por order_nsu). */
export async function findPendingPaymentByOrderNsu(orderNsu: string): Promise<Payment | null> {
  const { data, error } = await getSupabaseClient()
    .from("payments")
    .select()
    .eq("order_nsu", orderNsu)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Payment;
}

export type MarkPaymentPaidData = {
  transaction_nsu: string;
  invoice_slug?: string;
  /** Valor pago em reais */
  paid_amount: number;
  payment_method?: string;
  receipt_url?: string;
};

/**
 * Marca um pagamento como PAID.
 * Filtra por status=PENDING para garantir idempotência (segunda chamada retorna null).
 */
export async function markPaymentAsPaid(
  paymentId: string,
  data: MarkPaymentPaidData,
): Promise<Payment | null> {
  const { data: payment, error } = await getSupabaseClient()
    .from("payments")
    .update({
      status: "PAID",
      transaction_nsu: data.transaction_nsu,
      invoice_slug: data.invoice_slug ?? null,
      paid_amount: data.paid_amount,
      payment_method: data.payment_method ?? null,
      receipt_url: data.receipt_url ?? null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "PENDING")
    .select()
    .single();

  if (error || !payment) return null;
  return payment as Payment;
}
