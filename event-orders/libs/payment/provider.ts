/**
 * Contrato de qualquer provedor de pagamento.
 * A implementação atual é InfinitePay.
 * Para trocar de provedor: criar nova implementação, sem tocar nas rotas.
 */

export interface CheckoutItem {
  description: string;
  quantity: number;
  /** Valor em centavos */
  priceInCents: number;
}

export interface CreateCheckoutParams {
  orderNsu: string;
  items: CheckoutItem[];
  redirectUrl: string;
  webhookUrl: string;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
}

export interface CheckPaymentParams {
  orderNsu: string;
  transactionNsu: string;
  /** invoice_slug — enviado à InfinitePay como `slug` */
  invoiceSlug?: string;
}

export interface CheckPaymentResult {
  /** A consulta em si foi bem-sucedida (campo `success` da InfinitePay) */
  success: boolean;
  /** Pagamento aprovado */
  paid: boolean;
  /** Valor original do pedido em centavos */
  amountInCents?: number;
  /** Valor efetivamente pago em centavos (pode incluir taxa repassada) */
  paidAmountInCents?: number;
  installments?: number;
  /** "pix" | "credit_card" */
  paymentMethod?: string;
}

export interface PaymentProvider {
  createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult>;
  checkPayment(params: CheckPaymentParams): Promise<CheckPaymentResult>;
}
