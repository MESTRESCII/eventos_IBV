import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/repositories/orders.repository", () => ({
  findOrderByPublicId: vi.fn(),
  markOrderAsPaid: vi.fn(),
}));
vi.mock("@/db/repositories/payments.repository", () => ({
  findPendingPaymentByOrderNsu: vi.fn(),
  markPaymentAsPaid: vi.fn(),
}));
vi.mock("@/libs/payment/infinitepay/client", () => ({
  checkPayment: vi.fn(),
}));
vi.mock("@/libs/sheets", () => ({
  appendOrderRow: vi.fn(),
}));

import { findOrderByPublicId, markOrderAsPaid } from "@/db/repositories/orders.repository";
import {
  findPendingPaymentByOrderNsu,
  markPaymentAsPaid,
} from "@/db/repositories/payments.repository";
import { checkPayment } from "@/libs/payment/infinitepay/client";
import { appendOrderRow } from "@/libs/sheets";
import { POST } from "@/app/api/checkout/verify/route";

const mockFindOrder = vi.mocked(findOrderByPublicId);
const mockMarkOrderAsPaid = vi.mocked(markOrderAsPaid);
const mockFindPendingPayment = vi.mocked(findPendingPaymentByOrderNsu);
const mockMarkPaymentAsPaid = vi.mocked(markPaymentAsPaid);
const mockCheckPayment = vi.mocked(checkPayment);
const mockAppendOrderRow = vi.mocked(appendOrderRow);

const AWAITING_ORDER = {
  id: "uuid-order-1",
  public_id: "AB123",
  customer_name: "Maria Silva",
  pickup_date: "2026-09-26",
  total_amount: "10.00",
  payment_status: "AWAITING_PAYMENT",
  order_status: "CREATED",
  payment_id: null,
  paid_at: null,
  ready_at: null,
  delivered_at: null,
  delivered_by: null,
  created_at: "2026-09-08T00:00:00Z",
  items: [
    { id: "i1", product_name: "Batata", quantity: 1, unit_price: "10.00", subtotal: "10.00" },
  ],
};

const PENDING_PAYMENT = {
  id: "payment-uuid-1",
  order_id: "uuid-order-1",
  order_nsu: "AB123",
  amount: 10,
  status: "PENDING",
  transaction_nsu: null,
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/checkout/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppendOrderRow.mockResolvedValue(
      undefined as unknown as ReturnType<typeof appendOrderRow> extends Promise<infer T>
        ? T
        : never,
    );
  });

  it("retorna 400 para JSON inválido", async () => {
    const req = new Request("http://localhost/api/checkout/verify", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retorna 400 para dados inválidos", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("retorna 404 quando pedido não existe", async () => {
    mockFindOrder.mockResolvedValue(null);
    const res = await POST(makeRequest({ public_id: "NOEXIST", transaction_nsu: "txn-123" }));
    expect(res.status).toBe(404);
  });

  it("retorna paid:true imediatamente se pedido já está PAID", async () => {
    mockFindOrder.mockResolvedValue({
      ...AWAITING_ORDER,
      payment_status: "PAID",
      paid_at: "2026-09-08T12:00:00Z",
    });
    const res = await POST(makeRequest({ public_id: "AB123", transaction_nsu: "txn-123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paid).toBe(true);
    expect(body.payment_status).toBe("PAID");
    expect(mockCheckPayment).not.toHaveBeenCalled();
  });

  it("retorna paid:false quando InfinitePay não confirma", async () => {
    mockFindOrder.mockResolvedValue(AWAITING_ORDER);
    mockCheckPayment.mockResolvedValue({ paid: false });
    const res = await POST(makeRequest({ public_id: "AB123", transaction_nsu: "txn-123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paid).toBe(false);
    expect(mockMarkOrderAsPaid).not.toHaveBeenCalled();
  });

  it("marca pedido como PAID quando InfinitePay confirma", async () => {
    mockFindOrder.mockResolvedValue(AWAITING_ORDER);
    mockCheckPayment.mockResolvedValue({
      paid: true,
      amountInCents: 1000,
      paymentMethod: "pix",
      receiptUrl: "https://recibo.infinitepay.io/abc",
    });
    mockFindPendingPayment.mockResolvedValue(
      PENDING_PAYMENT as unknown as ReturnType<typeof findPendingPaymentByOrderNsu> extends Promise<
        infer T
      >
        ? T
        : never,
    );
    mockMarkPaymentAsPaid.mockResolvedValue(null);
    mockMarkOrderAsPaid.mockResolvedValue({
      ...AWAITING_ORDER,
      payment_status: "PAID",
      paid_at: "2026-09-08T12:00:00Z",
    });

    const res = await POST(makeRequest({ public_id: "AB123", transaction_nsu: "txn-123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paid).toBe(true);
    expect(body.payment_status).toBe("PAID");
    expect(mockMarkOrderAsPaid).toHaveBeenCalledWith("AB123");
    expect(mockMarkPaymentAsPaid).toHaveBeenCalled();
  });

  it("retorna 422 quando valor pago diverge do pedido", async () => {
    mockFindOrder.mockResolvedValue(AWAITING_ORDER); // total_amount = "10.00" = 1000 cents
    mockCheckPayment.mockResolvedValue({ paid: true, amountInCents: 500 }); // valor errado
    const res = await POST(makeRequest({ public_id: "AB123", transaction_nsu: "txn-123" }));
    expect(res.status).toBe(422);
  });

  it("retorna 500 quando InfinitePay lança erro", async () => {
    mockFindOrder.mockResolvedValue(AWAITING_ORDER);
    mockCheckPayment.mockRejectedValue(new Error("timeout"));
    const res = await POST(makeRequest({ public_id: "AB123", transaction_nsu: "txn-123" }));
    expect(res.status).toBe(500);
  });
});
