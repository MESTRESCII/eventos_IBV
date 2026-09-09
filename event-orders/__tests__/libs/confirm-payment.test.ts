import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/repositories/orders.repository", () => ({
  findOrderByPublicId: vi.fn(),
  markOrderAsPaid: vi.fn(),
}));
vi.mock("@/db/repositories/payments.repository", () => ({
  createPayment: vi.fn(),
  findPendingPaymentByOrderNsu: vi.fn(),
  markPaymentAsPaid: vi.fn(),
  recordPaymentAttempt: vi.fn(),
}));
vi.mock("@/libs/payment/infinitepay/client", () => ({ checkPayment: vi.fn() }));
vi.mock("@/libs/sheets", () => ({ appendOrderRow: vi.fn(), updateOrderRow: vi.fn() }));

import { findOrderByPublicId, markOrderAsPaid } from "@/db/repositories/orders.repository";
import {
  createPayment,
  findPendingPaymentByOrderNsu,
  markPaymentAsPaid,
  recordPaymentAttempt,
} from "@/db/repositories/payments.repository";
import { checkPayment } from "@/libs/payment/infinitepay/client";
import { appendOrderRow, updateOrderRow } from "@/libs/sheets";
import { confirmPayment } from "@/libs/payment/confirm-payment";

const mockFindOrder = vi.mocked(findOrderByPublicId);
const mockMarkOrderAsPaid = vi.mocked(markOrderAsPaid);
const mockCreatePayment = vi.mocked(createPayment);
const mockFindPendingPayment = vi.mocked(findPendingPaymentByOrderNsu);
const mockMarkPaymentAsPaid = vi.mocked(markPaymentAsPaid);
const mockRecordAttempt = vi.mocked(recordPaymentAttempt);
const mockCheckPayment = vi.mocked(checkPayment);
const mockAppend = vi.mocked(appendOrderRow);
const mockUpdate = vi.mocked(updateOrderRow);

const ORDER = {
  id: "order-uuid",
  public_id: "18C50",
  customer_name: "Outro C",
  pickup_date: "2026-09-26",
  total_amount: "1.00",
  payment_status: "AWAITING_PAYMENT",
  order_status: "CREATED",
  payment_id: null,
  paid_at: null,
  ready_at: null,
  delivered_at: null,
  delivered_by: null,
  created_at: "2026-09-08T20:00:00Z",
  items: [
    {
      id: "item-1",
      product_name: "Porção de Batata Frita",
      quantity: 1,
      unit_price: "1.00",
      subtotal: "1.00",
    },
  ],
};

const PAYMENT = {
  id: "payment-uuid",
  order_id: "order-uuid",
  provider: "infinitepay",
  order_nsu: "18C50",
  transaction_nsu: null,
  invoice_slug: null,
  amount: "1.00",
  paid_amount: null,
  payment_method: null,
  status: "PENDING",
  receipt_url: null,
  created_at: "2026-09-08T20:00:00Z",
  paid_at: null,
};

const INPUT = {
  publicId: "18C50",
  transactionNsu: "7be0cd5e-4b66-4299-b22c-fe491a73043e",
  invoiceSlug: "slug-abc",
  source: "redirect" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindPendingPayment.mockResolvedValue(PAYMENT);
  mockRecordAttempt.mockResolvedValue(PAYMENT);
  mockMarkPaymentAsPaid.mockResolvedValue(PAYMENT);
  mockMarkOrderAsPaid.mockResolvedValue({
    ...ORDER,
    payment_status: "PAID",
    paid_at: "2026-09-08T20:05:00Z",
  });
  mockAppend.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
});

describe("confirmPayment", () => {
  it("confirma o pedido quando a InfinitePay retorna paid:true", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockCheckPayment.mockResolvedValue({
      success: true,
      paid: true,
      amountInCents: 100,
      paidAmountInCents: 100,
      paymentMethod: "pix",
    });

    const result = await confirmPayment(INPUT);

    expect(result).toEqual({ outcome: "confirmed", paidAt: "2026-09-08T20:05:00Z" });
    expect(mockMarkOrderAsPaid).toHaveBeenCalledWith("18C50");
  });

  it("repassa o invoiceSlug para a consulta — sem ele o payment_check não encontra a fatura", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockCheckPayment.mockResolvedValue({ success: true, paid: true, amountInCents: 100 });

    await confirmPayment(INPUT);

    expect(mockCheckPayment).toHaveBeenCalledWith({
      orderNsu: "18C50",
      transactionNsu: "7be0cd5e-4b66-4299-b22c-fe491a73043e",
      invoiceSlug: "slug-abc",
    });
  });

  it("grava transaction_nsu ANTES de verificar, para o backstop poder tentar de novo", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockCheckPayment.mockRejectedValue(new Error("timeout"));

    const result = await confirmPayment(INPUT);

    expect(result.outcome).toBe("provider_error");
    expect(mockRecordAttempt).toHaveBeenCalledWith("payment-uuid", {
      transaction_nsu: "7be0cd5e-4b66-4299-b22c-fe491a73043e",
      invoice_slug: "slug-abc",
      receipt_url: undefined,
    });
    expect(mockMarkOrderAsPaid).not.toHaveBeenCalled();
  });

  it("cria o registro de pagamento se ele não existir", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockFindPendingPayment.mockResolvedValue(null);
    mockCreatePayment.mockResolvedValue(PAYMENT);
    mockCheckPayment.mockResolvedValue({ success: true, paid: true, amountInCents: 100 });

    await confirmPayment(INPUT);

    expect(mockCreatePayment).toHaveBeenCalledWith({
      order_id: "order-uuid",
      order_nsu: "18C50",
      amount: 1,
    });
  });

  it("aceita pagamento a maior (taxa repassada) em vez de recusar com divergência", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockCheckPayment.mockResolvedValue({
      success: true,
      paid: true,
      amountInCents: 100,
      paidAmountInCents: 110,
    });

    const result = await confirmPayment(INPUT);

    expect(result.outcome).toBe("confirmed");
    expect(mockMarkPaymentAsPaid).toHaveBeenCalledWith(
      "payment-uuid",
      expect.objectContaining({ paid_amount: 1.1 }),
    );
  });

  it("recusa pagamento a menor", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockCheckPayment.mockResolvedValue({
      success: true,
      paid: true,
      amountInCents: 100,
      paidAmountInCents: 50,
    });

    const result = await confirmPayment(INPUT);

    expect(result).toEqual({ outcome: "amount_mismatch", expectedCents: 100, paidCents: 50 });
    expect(mockMarkOrderAsPaid).not.toHaveBeenCalled();
  });

  it("não confirma quando success é false, mesmo com paid true", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockCheckPayment.mockResolvedValue({ success: false, paid: true });

    const result = await confirmPayment(INPUT);

    expect(result.outcome).toBe("not_paid");
    expect(mockMarkOrderAsPaid).not.toHaveBeenCalled();
  });

  it("é idempotente: pedido já PAGO não é reprocessado", async () => {
    mockFindOrder.mockResolvedValue({
      ...ORDER,
      payment_status: "PAID",
      paid_at: "2026-09-08T20:05:00Z",
    });

    const result = await confirmPayment(INPUT);

    expect(result).toEqual({ outcome: "already_paid", paidAt: "2026-09-08T20:05:00Z" });
    expect(mockCheckPayment).not.toHaveBeenCalled();
    expect(mockMarkOrderAsPaid).not.toHaveBeenCalled();
  });

  it("retorna order_not_found quando o pedido não existe", async () => {
    mockFindOrder.mockResolvedValue(null);
    const result = await confirmPayment(INPUT);
    expect(result).toEqual({ outcome: "order_not_found" });
  });

  it("não confirma pedido em estado não elegível", async () => {
    mockFindOrder.mockResolvedValue({ ...ORDER, payment_status: "CANCELLED" });
    const result = await confirmPayment(INPUT);
    expect(result).toEqual({ outcome: "not_confirmable", paymentStatus: "CANCELLED" });
  });

  it("AWAITING_PAYMENT entra na planilha via append (primeira aparição)", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockCheckPayment.mockResolvedValue({ success: true, paid: true, amountInCents: 100 });

    await confirmPayment(INPUT);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockAppend).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("PENDING atualiza a linha existente na planilha", async () => {
    mockFindOrder.mockResolvedValue({ ...ORDER, payment_status: "PENDING" });
    mockCheckPayment.mockResolvedValue({ success: true, paid: true, amountInCents: 100 });

    await confirmPayment(INPUT);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockAppend).not.toHaveBeenCalled();
  });

  it("falha na planilha não impede a confirmação do pedido", async () => {
    mockFindOrder.mockResolvedValue(ORDER);
    mockCheckPayment.mockResolvedValue({ success: true, paid: true, amountInCents: 100 });
    mockAppend.mockRejectedValue(new Error("Sheets fora do ar"));

    const result = await confirmPayment(INPUT);
    await new Promise((r) => setTimeout(r, 0));

    expect(result.outcome).toBe("confirmed");
  });
});
