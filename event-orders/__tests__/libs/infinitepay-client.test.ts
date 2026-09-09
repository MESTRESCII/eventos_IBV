import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkPayment, createCheckout } from "@/libs/payment/infinitepay/client";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.INFINITEPAY_HANDLE = "jms_99";
  process.env.INFINITEPAY_API_URL = "https://api.checkout.infinitepay.io";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastBody() {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string);
}

describe("checkPayment", () => {
  it("envia o campo `slug` (não `invoice_slug`) — exigência da API payment_check", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, paid: true }));

    await checkPayment({
      orderNsu: "18C50",
      transactionNsu: "7be0cd5e-4b66-4299-b22c-fe491a73043e",
      invoiceSlug: "abc123",
    });

    const body = lastBody();
    expect(body.slug).toBe("abc123");
    expect(body).not.toHaveProperty("invoice_slug");
    expect(body.handle).toBe("jms_99");
    expect(body.order_nsu).toBe("18C50");
    expect(body.transaction_nsu).toBe("7be0cd5e-4b66-4299-b22c-fe491a73043e");
  });

  it("envia slug vazio quando não há invoice_slug, em vez de omitir o campo", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, paid: false }));
    await checkPayment({ orderNsu: "18C50", transactionNsu: "txn" });
    expect(lastBody().slug).toBe("");
  });

  it("lê capture_method e paid_amount, os nomes reais da resposta", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        paid: true,
        amount: 100,
        paid_amount: 110,
        installments: 1,
        capture_method: "pix",
      }),
    );

    const result = await checkPayment({ orderNsu: "18C50", transactionNsu: "txn" });

    expect(result).toEqual({
      success: true,
      paid: true,
      amountInCents: 100,
      paidAmountInCents: 110,
      installments: 1,
      paymentMethod: "pix",
    });
  });

  it("propaga success:false sem tratar como pago", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, paid: false }));
    const result = await checkPayment({ orderNsu: "18C50", transactionNsu: "txn" });
    expect(result.success).toBe(false);
    expect(result.paid).toBe(false);
  });

  it("considera success ausente como sucesso, desde que paid seja true", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ paid: true, amount: 100 }));
    const result = await checkPayment({ orderNsu: "18C50", transactionNsu: "txn" });
    expect(result.success).toBe(true);
    expect(result.paid).toBe(true);
  });

  it("erro HTTP vira exceção com status e corpo, para o log ser diagnosticável", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"error":"invalid slug"}',
    });

    await expect(checkPayment({ orderNsu: "18C50", transactionNsu: "txn" })).rejects.toThrow(
      /422.*invalid slug/,
    );
  });

  it("normaliza barra final em INFINITEPAY_API_URL", async () => {
    process.env.INFINITEPAY_API_URL = "https://api.checkout.infinitepay.io/";
    fetchMock.mockResolvedValue(jsonResponse({ success: true, paid: true }));
    await checkPayment({ orderNsu: "18C50", transactionNsu: "txn" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.checkout.infinitepay.io/payment_check");
  });
});

describe("createCheckout", () => {
  it("envia webhook_url e redirect_url e devolve a URL do checkout", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ url: "https://checkout.infinitepay.io/xyz" }));

    const result = await createCheckout({
      orderNsu: "18C50",
      items: [{ description: "Batata", quantity: 1, priceInCents: 100 }],
      redirectUrl: "https://site.com/pedido/18C50/confirmacao",
      webhookUrl: "https://site.com/api/webhooks/infinitepay/tok",
    });

    expect(result.checkoutUrl).toBe("https://checkout.infinitepay.io/xyz");
    const body = lastBody();
    expect(body.webhook_url).toBe("https://site.com/api/webhooks/infinitepay/tok");
    expect(body.items[0].price).toBe(100);
  });
});
