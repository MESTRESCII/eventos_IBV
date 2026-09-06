/**
 * Contrato de qualquer provedor de pagamento.
 * A implementação atual é InfinitePayProvider.
 * Para trocar de provedor: apenas criar nova implementação, sem tocar nas rotas.
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
  invoiceSlug?: string;
}

export interface CheckPaymentResult {
  paid: boolean;
  /** Valor pago em centavos (pode ser undefined se o provedor não retornar) */
  amountInCents?: number;
  paymentMethod?: string;
  receiptUrl?: string;
}

export interface PaymentProvider {
  createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult>;
  checkPayment(params: CheckPaymentParams): Promise<CheckPaymentResult>;
}
