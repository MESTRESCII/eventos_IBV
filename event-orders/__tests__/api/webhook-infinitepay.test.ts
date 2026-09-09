import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/repositories/payments.repository", () => ({
  findPaymentByTransactionNsu: vi.fn(),
}));
vi.mock("@/libs/payment/confirm-payment", () => ({ confirmPayment: vi.fn() }));

import { findPaymentByTransactionNsu } from "@/db/repositories/payments.repository";
import { confirmPayment } from "@/libs/payment/confirm-payment";
import { POST } from "@/app/api/webhooks/infinitepay/[token]/route";

const mockFindByTxn = vi.mocked(findPaymentByTransactionNsu);
const mockConfirm = vi.mocked(confirmPayment);

const TOKEN = "token-secreto-de-teste";

const PAYLOAD = {
  order_nsu: "18C50",
  transaction_nsu: "7be0cd5e-4b66-4299-b22c-fe491a73043e",
  invoice_slug: "slug-abc",
  amount: 100,
  paid_amount: 100,
  capture_method: "pix",
  receipt_url: "https://recibo.infinitepay.io/7be0cd5e",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/webhooks/infinitepay/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(token = TOKEN) {
  return { params: Promise.resolve({ token }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INFINITEPAY_WEBHOOK_TOKEN = TOKEN;
  mockFindByTxn.mockResolvedValue(null);
});

describe("POST /api/webhooks/infinitepay/:token", () => {
  it("retorna 401 com token errado", async () => {
    const res = await POST(makeRequest(PAYLOAD), ctx("token-errado"));
    expect(res.status).toBe(401);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("retorna 400 para JSON inválido", async () => {
    expect((await POST(makeRequest("não é json"), ctx())).status).toBe(400);
  });

  it("retorna 400 quando falta transaction_nsu", async () => {
    const res = await POST(makeRequest({ order_nsu: "18C50" }), ctx());
    expect(res.status).toBe(400);
  });

  it("confirma via payment_check — nunca confia no payload do webhook", async () => {
    mockConfirm.mockResolvedValue({ outcome: "confirmed", paidAt: "2026-09-08T20:05:00Z" });

    const res = await POST(makeRequest(PAYLOAD), ctx());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(mockConfirm).toHaveBeenCalledWith({
      publicId: "18C50",
      transactionNsu: "7be0cd5e-4b66-4299-b22c-fe491a73043e",
      invoiceSlug: "slug-abc",
      receiptUrl: "https://recibo.infinitepay.io/7be0cd5e",
      source: "webhook",
    });
  });

  it("é idempotente: transaction_nsu já pago retorna 200 sem reprocessar", async () => {
    mockFindByTxn.mockResolvedValue({ status: "PAID" } as never);

    const res = await POST(makeRequest(PAYLOAD), ctx());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ idempotent: true });
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("responde 400 quando ainda não pago, para a InfinitePay reenviar", async () => {
    mockConfirm.mockResolvedValue({ outcome: "not_paid" });
    const res = await POST(makeRequest(PAYLOAD), ctx());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ success: false });
  });

  it("responde 400 quando o pedido ainda não existe, para provocar reenvio", async () => {
    mockConfirm.mockResolvedValue({ outcome: "order_not_found" });
    expect((await POST(makeRequest(PAYLOAD), ctx())).status).toBe(400);
  });

  it("responde 400 em falha de consulta, para provocar reenvio", async () => {
    mockConfirm.mockResolvedValue({ outcome: "provider_error", message: "timeout" });
    expect((await POST(makeRequest(PAYLOAD), ctx())).status).toBe(400);
  });

  it("responde 200 em divergência de valor — reenviar não resolveria", async () => {
    mockConfirm.mockResolvedValue({
      outcome: "amount_mismatch",
      expectedCents: 100,
      paidCents: 50,
    });
    const res = await POST(makeRequest(PAYLOAD), ctx());
    expect(res.status).toBe(200);
  });

  it("normaliza order_nsu para maiúsculas", async () => {
    mockConfirm.mockResolvedValue({ outcome: "confirmed", paidAt: "x" });
    await POST(makeRequest({ ...PAYLOAD, order_nsu: "18c50" }), ctx());
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ publicId: "18C50" }));
  });
});
