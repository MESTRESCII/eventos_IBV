/**
 * Tipos das requisições e respostas da API InfinitePay Checkout Integrado.
 * Referência: https://www.infinitepay.io/checkout-documentacao
 */

export interface InfinitePayItem {
  quantity: number;
  /** Valor em centavos. Ex.: R$1,00 = 100 */
  price: number;
  description: string;
}

export interface CreateLinkRequest {
  handle: string;
  order_nsu: string;
  items: InfinitePayItem[];
  redirect_url: string;
  webhook_url: string;
}

/** Resposta de POST /links. */
export interface CreateLinkResponse {
  url: string;
  [key: string]: unknown;
}

/**
 * Requisição de POST /payment_check.
 *
 * ATENÇÃO: o campo é `slug` (não `invoice_slug`). A InfinitePay usa `invoice_slug`
 * apenas no payload do webhook; na consulta de status o nome é `slug`.
 */
export interface PaymentCheckRequest {
  handle: string;
  order_nsu: string;
  transaction_nsu: string;
  slug: string;
}

/** Resposta de POST /payment_check. */
export interface PaymentCheckResponse {
  success: boolean;
  paid: boolean;
  /** Valor original do pedido em centavos */
  amount?: number;
  /** Valor efetivamente pago em centavos (pode incluir taxa repassada) */
  paid_amount?: number;
  installments?: number;
  /** "credit_card" | "pix" */
  capture_method?: string;
  [key: string]: unknown;
}

/** Payload recebido no webhook. */
export interface WebhookPayload {
  order_nsu: string;
  transaction_nsu: string;
  invoice_slug?: string;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
  receipt_url?: string;
  [key: string]: unknown;
}
