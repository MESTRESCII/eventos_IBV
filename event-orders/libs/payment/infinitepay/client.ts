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

const REQUEST_TIMEOUT_MS = 10_000;

function getConfig() {
  const handle = process.env.INFINITEPAY_HANDLE;
  const apiUrl = (process.env.INFINITEPAY_API_URL ?? "https://api.checkout.infinitepay.io").replace(
    /\/+$/,
    "",
  );
  if (!handle) throw new Error("INFINITEPAY_HANDLE não configurado");
  return { handle, apiUrl };
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`InfinitePay ${url} respondeu ${res.status}: ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`InfinitePay ${url}: resposta não é JSON: ${text.slice(0, 500)}`);
  }
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

  const data = (await postJson(`${apiUrl}/links`, body)) as CreateLinkResponse;

  const checkoutUrl = data.url ?? (data as Record<string, unknown>)["checkout_url"];
  if (!checkoutUrl || typeof checkoutUrl !== "string") {
    throw new Error(
      `InfinitePay /links: campo URL não encontrado na resposta: ${JSON.stringify(data)}`,
    );
  }

  return { checkoutUrl };
}

/**
 * Consulta o status real de um pagamento na InfinitePay — fonte autoritativa.
 * POST /payment_check
 *
 * O webhook é apenas campainha: sempre confirmar por aqui antes de marcar como PAGO.
 * O campo do slug na requisição é `slug` (o webhook entrega o mesmo valor como `invoice_slug`).
 */
export async function checkPayment(params: CheckPaymentParams): Promise<CheckPaymentResult> {
  const { handle, apiUrl } = getConfig();

  const body: PaymentCheckRequest = {
    handle,
    order_nsu: params.orderNsu,
    transaction_nsu: params.transactionNsu,
    slug: params.invoiceSlug ?? "",
  };

  const data = (await postJson(`${apiUrl}/payment_check`, body)) as PaymentCheckResponse;

  return {
    // Alguns retornos omitem `success`; ausência não invalida um `paid: true` explícito.
    success: data.success !== false,
    paid: data.paid === true,
    amountInCents: typeof data.amount === "number" ? data.amount : undefined,
    paidAmountInCents: typeof data.paid_amount === "number" ? data.paid_amount : undefined,
    installments: typeof data.installments === "number" ? data.installments : undefined,
    paymentMethod: typeof data.capture_method === "string" ? data.capture_method : undefined,
  };
}
