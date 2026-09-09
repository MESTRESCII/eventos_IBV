import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/repositories/payments.repository", () => ({
  listReconcilablePayments: vi.fn(),
}));
vi.mock("@/libs/payment/confirm-payment", () => ({ confirmPayment: vi.fn() }));

import { listReconcilablePayments } from "@/db/repositories/payments.repository";
import { confirmPayment } from "@/libs/payment/confirm-payment";
import { POST } from "@/app/api/cron/reconcile/[token]/route";

const mockList = vi.mocked(listReconcilablePayments);
const mockConfirm = vi.mocked(confirmPayment);

const TOKEN = "token-secreto-de-teste";

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "payment-1",
    order_id: "order-1",
    provider: "infinitepay",
    order_nsu: "18C50",
    transaction_nsu: "7be0cd5e-4b66-4299-b22c-fe491a73043e",
    invoice_slug: "slug-abc",
    amount: "1.00",
    paid_amount: null,
    payment_method: null,
    status: "PENDING",
    receipt_url: null,
    created_at: "2026-09-08T20:00:00Z",
    paid_at: null,
    ...overrides,
  } as never;
}

function req() {
  return new Request("http://localhost/api/cron/reconcile/x", { method: "POST" });
}
function ctx(token = TOKEN) {
  return { params: Promise.resolve({ token }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INFINITEPAY_WEBHOOK_TOKEN = TOKEN;
});

describe("POST /api/cron/reconcile/:token", () => {
  it("retorna 401 com token errado", async () => {
    const res = await POST(req(), ctx("errado"));
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("confirma pagamentos pendentes que a InfinitePay já aprovou", async () => {
    mockList.mockResolvedValue([payment(), payment({ id: "payment-2", order_nsu: "AB123" })]);
    mockConfirm.mockResolvedValue({ outcome: "confirmed", paidAt: "2026-09-08T20:05:00Z" });

    const res = await POST(req(), ctx());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      scanned: 2,
      confirmed: 2,
      still_pending: 0,
      failed: 0,
      confirmed_orders: ["18C50", "AB123"],
    });
  });

  it("usa a origem backstop e repassa slug e recibo guardados", async () => {
    mockList.mockResolvedValue([payment({ receipt_url: "https://recibo.infinitepay.io/abc" })]);
    mockConfirm.mockResolvedValue({ outcome: "not_paid" });

    await POST(req(), ctx());

    expect(mockConfirm).toHaveBeenCalledWith({
      publicId: "18C50",
      transactionNsu: "7be0cd5e-4b66-4299-b22c-fe491a73043e",
      invoiceSlug: "slug-abc",
      receiptUrl: "https://recibo.infinitepay.io/abc",
      source: "backstop",
    });
  });

  it("contabiliza pendentes e falhas sem interromper a varredura", async () => {
    mockList.mockResolvedValue([
      payment({ id: "p1" }),
      payment({ id: "p2" }),
      payment({ id: "p3" }),
    ]);
    mockConfirm
      .mockResolvedValueOnce({ outcome: "confirmed", paidAt: "x" })
      .mockResolvedValueOnce({ outcome: "not_paid" })
      .mockResolvedValueOnce({ outcome: "provider_error", message: "timeout" });

    const res = await POST(req(), ctx());

    await expect(res.json()).resolves.toMatchObject({
      scanned: 3,
      confirmed: 1,
      still_pending: 1,
      failed: 1,
    });
  });

  it("é seguro rodar sem nada a reconciliar", async () => {
    mockList.mockResolvedValue([]);
    const res = await POST(req(), ctx());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ scanned: 0, confirmed: 0 });
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});
