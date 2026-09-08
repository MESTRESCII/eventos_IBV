import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/repositories/orders.repository", () => ({
  findOrderByPublicId: vi.fn(),
  markOrderAsPaid: vi.fn(),
}));
vi.mock("@/db/repositories/payments.repository", () => ({
  findPaymentByTransactionNsu: vi.fn(),
  findPendingPaymentByOrderNsu: vi.fn(),
  markPaymentAsPaid: vi.fn(),
}));
vi.mock("@/libs/payment/infinitepay/client", () => ({
  checkPayment: vi.fn(),
}));
vi.mock("@/libs/sheets", () => ({
  appendOrderRow: vi.fn(),
  updateOrderRow: vi.fn(),
}));

import { findOrderByPublicId, markOrderAsPaid } from "@/db/repositories/orders.repository";
import {
  findPaymentByTransactionNsu,
  findPendingPaymentByOrderNsu,
  markPaymentAsPaid,
} from "@/db/repositories/payments.repository";
import { checkPayment } from "@/libs/payment/infinitepay/client";
import { appendOrderRow, updateOrderRow } from "@/libs/sheets";
import { POST } from "@/app/api/webhooks/infinitepay/[token]/route";

const mockFindOrder = vi.mocked(findOrderByPublicId);
const mockMarkOrderPaid = vi.mocked(markOrderAsPaid);
const mockFindByTxNsu = vi.mocked(findPaymentByTransactionNsu);
const mockFindPending = vi.mocked(findPendingPaymentByOrderNsu);
const mockMarkPaymentPaid = vi.mocked(markPaymentAsPaid);
const mockCheckPayment = vi.mocked(checkPayment);
const mockAppendOrderRow = vi.mocked(appendOrderRow);
const mockUpdateOrderRow = vi.mocked(updateOrderRow);

const VALID_TOKEN = "super-secret-token-xyz";

const PENDING_ORDER = {
  id: "uuid-order-1",
  public_id: "ABC12",
  customer_name: "João",
  pickup_date: "2026-09-26",
  total_amount: "1.00",
  payment_status: "PENDING",
  order_status: "CREATED",
  payment_id: null,
  paid_at: null,
  ready_at: null,
  delivered_at: null,
  delivered_by: null,
  created_at: "2026-09-06T00:00:00Z",
  items: [],
};

const AWAITING_ORDER = {
  ...PENDING_ORDER,
  payment_status: "AWAITING_PAYMENT",
};

const PENDING_PAYMENT = {
  id: "uuid-pay-1",
  order_id: "uuid-order-1",
  provider: "infinitepay",
  order_nsu: "ABC12",
  transaction_nsu: null,
  invoice_slug: null,
  amount: "1.00",
  paid_amount: null,
  payment_method: null,
  status: "PENDING",
  receipt_url: null,
  created_at: "2026-09-06T00:00:00Z",
  paid_at: null,
};

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

function makeRequest(body: object) {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = { order_nsu: "ABC12", transaction_nsu: "TX-001", invoice_slug: "slug-1" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INFINITEPAY_WEBHOOK_TOKEN = VALID_TOKEN;
});

describe("POST /api/webhooks/infinitepay/[token]", () => {
  it("retorna 401 com token inválido", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams("token-errado"));
    expect(res.status).toBe(401);
  });

  it("retorna 400 com JSON inválido", async () => {
    const req = new Request("http://localhost", { method: "POST", body: "não é json" });
    const res = await POST(req, makeParams(VALID_TOKEN));
    expect(res.status).toBe(400);
  });

  it("retorna 400 se order_nsu ou transaction_nsu ausentes", async () => {
    const res = await POST(makeRequest({ order_nsu: "ABC12" }), makeParams(VALID_TOKEN));
    expect(res.status).toBe(400);
  });

  it("retorna 200 idempotente se transaction_nsu já foi processado (PAID)", async () => {
    mockFindByTxNsu.mockResolvedValueOnce({ ...PENDING_PAYMENT, status: "PAID" });
    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(mockCheckPayment).not.toHaveBeenCalled();
  });

  it("retorna 404 se order_nsu não existe no sistema", async () => {
    mockFindByTxNsu.mockResolvedValueOnce(null);
    mockFindOrder.mockResolvedValueOnce(null);
    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(404);
  });

  it("retorna 200 idempotente se pedido já está PAID", async () => {
    mockFindByTxNsu.mockResolvedValueOnce(null);
    mockFindOrder.mockResolvedValueOnce({ ...PENDING_ORDER, payment_status: "PAID" });
    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
  });

  it("retorna ok:false se InfinitePay não confirmar pagamento", async () => {
    mockFindByTxNsu.mockResolvedValueOnce(null);
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER);
    mockCheckPayment.mockResolvedValueOnce({ paid: false });
    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paid).toBe(false);
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  it("retorna 422 se valor pago diverge do pedido", async () => {
    mockFindByTxNsu.mockResolvedValueOnce(null);
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER); // total_amount = 1.00 = 100 centavos
    mockCheckPayment.mockResolvedValueOnce({ paid: true, amountInCents: 200 }); // 2.00
    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(422);
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });

  it("pedido PENDING: marca como PAID e chama updateOrderRow no Sheets", async () => {
    mockFindByTxNsu.mockResolvedValueOnce(null);
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER);
    mockCheckPayment.mockResolvedValueOnce({
      paid: true,
      amountInCents: 100,
      paymentMethod: "pix",
    });
    mockFindPending.mockResolvedValueOnce(PENDING_PAYMENT);
    mockMarkPaymentPaid.mockResolvedValueOnce({ ...PENDING_PAYMENT, status: "PAID" });
    mockMarkOrderPaid.mockResolvedValueOnce({
      ...PENDING_ORDER,
      payment_status: "PAID",
      paid_at: "2026-09-08T12:00:00Z",
    } as Awaited<ReturnType<typeof markOrderAsPaid>>);

    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Aguarda fire-and-forget
    await vi.waitFor(() => expect(mockUpdateOrderRow).toHaveBeenCalled());
    expect(mockAppendOrderRow).not.toHaveBeenCalled();
    expect(mockUpdateOrderRow).toHaveBeenCalledWith(
      "ABC12",
      expect.objectContaining({ paymentStatus: "PAID" }),
    );
  });

  it("pedido AWAITING_PAYMENT: marca como PAID e chama appendOrderRow no Sheets", async () => {
    mockFindByTxNsu.mockResolvedValueOnce(null);
    mockFindOrder.mockResolvedValueOnce(AWAITING_ORDER);
    mockCheckPayment.mockResolvedValueOnce({
      paid: true,
      amountInCents: 100,
      paymentMethod: "pix",
    });
    mockFindPending.mockResolvedValueOnce(PENDING_PAYMENT);
    mockMarkPaymentPaid.mockResolvedValueOnce({ ...PENDING_PAYMENT, status: "PAID" });
    mockMarkOrderPaid.mockResolvedValueOnce({
      ...AWAITING_ORDER,
      payment_status: "PAID",
      paid_at: "2026-09-08T12:00:00Z",
    } as Awaited<ReturnType<typeof markOrderAsPaid>>);

    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Aguarda fire-and-forget — deve usar append (pedido nunca esteve no Sheets)
    await vi.waitFor(() => expect(mockAppendOrderRow).toHaveBeenCalled());
    expect(mockUpdateOrderRow).not.toHaveBeenCalled();
    expect(mockAppendOrderRow).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: "ABC12", paymentStatus: "PAID" }),
    );
  });

  it("ainda marca pedido como PAID mesmo sem payment record (pagamento manual → webhook)", async () => {
    mockFindByTxNsu.mockResolvedValueOnce(null);
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER);
    mockCheckPayment.mockResolvedValueOnce({ paid: true, amountInCents: 100 });
    mockFindPending.mockResolvedValueOnce(null);
    mockMarkOrderPaid.mockResolvedValueOnce({
      ...PENDING_ORDER,
      payment_status: "PAID",
    } as Awaited<ReturnType<typeof markOrderAsPaid>>);

    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(200);
    expect(mockMarkPaymentPaid).not.toHaveBeenCalled();
    expect(mockMarkOrderPaid).toHaveBeenCalledWith("ABC12");
  });

  it("retorna 500 se payment_check falhar (InfinitePay indisponível)", async () => {
    mockFindByTxNsu.mockResolvedValueOnce(null);
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER);
    mockCheckPayment.mockRejectedValueOnce(new Error("Timeout"));

    const res = await POST(makeRequest(VALID_PAYLOAD), makeParams(VALID_TOKEN));
    expect(res.status).toBe(500);
    expect(mockMarkOrderPaid).not.toHaveBeenCalled();
  });
});
