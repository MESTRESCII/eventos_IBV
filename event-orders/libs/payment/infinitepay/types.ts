/** Tipos das requisições e respostas da API InfinitePay Checkout Integrado. */

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

/**
 * Resposta de POST /links.
 * Verificar campo exato na documentação: https://www.infinitepay.io/checkout-documentacao
 */
export interface CreateLinkResponse {
  url: string;
  [key: string]: unknown;
}

export interface PaymentCheckRequest {
  handle: string;
  order_nsu: string;
  transaction_nsu: string;
  invoice_slug?: string;
}

/**
 * Resposta de POST /payment_check.
 * Verificar campos exatos na documentação oficial.
 */
export interface PaymentCheckResponse {
  paid: boolean;
  /** Valor pago em centavos */
  amount?: number;
  payment_method?: string;
  receipt_url?: string;
  [key: string]: unknown;
}

/** Payload recebido no webhook. Campos mínimos garantidos pela InfinitePay. */
export interface WebhookPayload {
  order_nsu: string;
  transaction_nsu: string;
  invoice_slug?: string;
  amount?: number;
  paid_amount?: number;
  payment_method?: string;
  receipt_url?: string;
  [key: string]: unknown;
}
