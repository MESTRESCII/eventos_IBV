import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/libs/payment/confirm-payment", () => ({ confirmPayment: vi.fn() }));

import { confirmPayment } from "@/libs/payment/confirm-payment";
import { POST } from "@/app/api/checkout/verify/route";

const mockConfirm = vi.mocked(confirmPayment);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/checkout/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = { public_id: "18c50", transaction_nsu: "txn-123", invoice_slug: "slug-abc" };

beforeEach(() => vi.clearAllMocks());

describe("POST /api/checkout/verify", () => {
  it("retorna 400 para JSON inválido", async () => {
    const res = await POST(
      new Request("http://localhost/api/checkout/verify", { method: "POST", body: "não é json" }),
    );
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando faltam campos obrigatórios", async () => {
    const res = await POST(makeRequest({ public_id: "18C50" }));
    expect(res.status).toBe(400);
  });

  it("normaliza o public_id para maiúsculas antes de confirmar", async () => {
    mockConfirm.mockResolvedValue({ outcome: "not_paid" });
    await POST(makeRequest(VALID));
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: "18C50", source: "redirect" }),
    );
  });

  it("repassa invoice_slug e receipt_url ao serviço de confirmação", async () => {
    mockConfirm.mockResolvedValue({ outcome: "not_paid" });
    await POST(makeRequest({ ...VALID, receipt_url: "https://recibo.infinitepay.io/abc" }));
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceSlug: "slug-abc",
        receiptUrl: "https://recibo.infinitepay.io/abc",
      }),
    );
  });

  it("retorna paid:true quando confirmado", async () => {
    mockConfirm.mockResolvedValue({ outcome: "confirmed", paidAt: "2026-09-08T20:05:00Z" });
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      paid: true,
      payment_status: "PAID",
      paid_at: "2026-09-08T20:05:00Z",
    });
  });

  it("retorna paid:true quando o pedido já estava pago", async () => {
    mockConfirm.mockResolvedValue({ outcome: "already_paid", paidAt: "2026-09-08T20:05:00Z" });
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ paid: true, payment_status: "PAID" });
  });

  it("retorna paid:false enquanto a InfinitePay não confirma", async () => {
    mockConfirm.mockResolvedValue({ outcome: "not_paid" });
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ paid: false });
  });

  it("retorna 404 quando o pedido não existe", async () => {
    mockConfirm.mockResolvedValue({ outcome: "order_not_found" });
    expect((await POST(makeRequest(VALID))).status).toBe(404);
  });

  it("retorna 422 quando o valor pago é menor que o pedido", async () => {
    mockConfirm.mockResolvedValue({
      outcome: "amount_mismatch",
      expectedCents: 100,
      paidCents: 50,
    });
    expect((await POST(makeRequest(VALID))).status).toBe(422);
  });

  it("retorna 500 quando a consulta à InfinitePay falha", async () => {
    mockConfirm.mockResolvedValue({ outcome: "provider_error", message: "timeout" });
    expect((await POST(makeRequest(VALID))).status).toBe(500);
  });
});

describe("robustez do receipt_url", () => {
  it("descarta receipt_url malformado em vez de recusar a confirmação", async () => {
    mockConfirm.mockResolvedValue({ outcome: "confirmed", paidAt: "2026-09-08T20:05:00Z" });

    const res = await POST(makeRequest({ ...VALID, receipt_url: "não é uma url" }));

    expect(res.status).toBe(200);
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ receiptUrl: undefined }));
  });
});
