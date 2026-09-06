import type {
  CreateLinkRequest,
  CreateLinkResponse,
  PaymentCheckRequest,
  PaymentCheckResponse,
} from "./types";
import type {
  CreateCheckoutParams,
  CreateCheckoutResult,
  CheckPaymentParams,
  CheckPaymentResult,
} from "../provider";

function getConfig() {
  const handle = process.env.INFINITEPAY_HANDLE;
  const apiUrl = process.env.INFINITEPAY_API_URL ?? "https://api.checkout.infinitepay.io";
  if (!handle) throw new Error("INFINITEPAY_HANDLE não configurado");
  return { handle, apiUrl };
}

/**
 * Cria um link de checkout na InfinitePay.
 * POST /links
 */
export async function createCheckout(params: CreateCheckoutParams): Promise<CreateCheckoutResult> {
  const { handle, apiUrl } = getConfig();

  const body: CreateLinkRequest = {
    handle,
    order_nsu: params.orderNsu,
    items: params.items.map((i) => ({
      quantity: i.quantity,
      price: i.priceInCents,
      description: i.description,
    })),
    redirect_url: params.redirectUrl,
    webhook_url: params.webhookUrl,
  };

  const res = await fetch(`${apiUrl}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(sem corpo)");
    throw new Error(`InfinitePay /links ${res.status}: ${text}`);
  }

  const data = (await res.json()) as CreateLinkResponse;

  // Verificar campo exato na documentação oficial antes de ir a produção
  const checkoutUrl = data.url ?? (data as Record<string, unknown>)["checkout_url"];
  if (!checkoutUrl || typeof checkoutUrl !== "string") {
    throw new Error(
      `InfinitePay /links: campo URL não encontrado na resposta: ${JSON.stringify(data)}`,
    );
  }

  return { checkoutUrl };
}

/**
 * Verifica se um pagamento foi confirmado na InfinitePay.
 * Fonte autoritativa — chamar após receber o webhook (webhook = campainha apenas).
 * POST /payment_check
 */
export async function checkPayment(params: CheckPaymentParams): Promise<CheckPaymentResult> {
  const { handle, apiUrl } = getConfig();

  const body: PaymentCheckRequest = {
    handle,
    order_nsu: params.orderNsu,
    transaction_nsu: params.transactionNsu,
    ...(params.invoiceSlug ? { invoice_slug: params.invoiceSlug } : {}),
  };

  const res = await fetch(`${apiUrl}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(sem corpo)");
    throw new Error(`InfinitePay /payment_check ${res.status}: ${text}`);
  }

  const data = (await res.json()) as PaymentCheckResponse;

  return {
    paid: data.paid === true,
    amountInCents: typeof data.amount === "number" ? data.amount : undefined,
    paymentMethod: data.payment_method,
    receiptUrl: data.receipt_url,
  };
}
