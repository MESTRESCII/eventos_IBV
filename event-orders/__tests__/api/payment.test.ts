import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/repositories/orders.repository", () => ({
  findOrderByPublicId: vi.fn(),
}));
vi.mock("@/db/repositories/payments.repository", () => ({
  createPayment: vi.fn(),
}));
vi.mock("@/libs/payment/infinitepay/client", () => ({
  createCheckout: vi.fn(),
}));

import { findOrderByPublicId } from "@/db/repositories/orders.repository";
import { createPayment } from "@/db/repositories/payments.repository";
import { createCheckout } from "@/libs/payment/infinitepay/client";
import { POST } from "@/app/api/orders/[public_id]/payment/route";

const mockFindOrder = vi.mocked(findOrderByPublicId);
const mockCreatePayment = vi.mocked(createPayment);
const mockCreateCheckout = vi.mocked(createCheckout);

const PENDING_ORDER = {
  id: "uuid-order-1",
  public_id: "ABC12",
  customer_name: "João",
  pickup_date: "2026-09-26",
  total_amount: "2.00",
  payment_status: "PENDING",
  order_status: "CREATED",
  payment_id: null,
  paid_at: null,
  ready_at: null,
  delivered_at: null,
  delivered_by: null,
  created_at: "2026-09-06T00:00:00Z",
  items: [{ id: "i1", product_name: "Coxinha", quantity: 2, unit_price: "1.00", subtotal: "2.00" }],
};

function makeParams(public_id: string) {
  return { params: Promise.resolve({ public_id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INFINITEPAY_WEBHOOK_TOKEN = "test-token-abc";
  process.env.BASE_URL = "http://localhost:3000";
});

describe("POST /api/orders/[public_id]/payment", () => {
  it("retorna 404 se pedido não existe", async () => {
    mockFindOrder.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://localhost"), makeParams("XXXXX"));
    expect(res.status).toBe(404);
  });

  it("retorna 409 se pedido já está PAID", async () => {
    mockFindOrder.mockResolvedValueOnce({ ...PENDING_ORDER, payment_status: "PAID" });
    const res = await POST(new Request("http://localhost"), makeParams("ABC12"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/já pago/i);
  });

  it("retorna 500 se INFINITEPAY_WEBHOOK_TOKEN não está configurado", async () => {
    delete process.env.INFINITEPAY_WEBHOOK_TOKEN;
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER);
    const res = await POST(new Request("http://localhost"), makeParams("ABC12"));
    expect(res.status).toBe(500);
  });

  it("cria checkout, registra payment e retorna checkout_url", async () => {
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER);
    mockCreateCheckout.mockResolvedValueOnce({
      checkoutUrl: "https://checkout.infinitepay.io/abc",
    });
    mockCreatePayment.mockResolvedValueOnce({} as Awaited<ReturnType<typeof createPayment>>);

    const res = await POST(new Request("http://localhost"), makeParams("ABC12"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkout_url).toBe("https://checkout.infinitepay.io/abc");

    // Verifica que os itens foram convertidos para centavos
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNsu: "ABC12",
        items: [{ description: "Coxinha", quantity: 2, priceInCents: 100 }],
      }),
    );

    // Verifica que createPayment foi chamado com os dados corretos
    expect(mockCreatePayment).toHaveBeenCalledWith({
      order_id: "uuid-order-1",
      order_nsu: "ABC12",
      amount: 2.0,
    });
  });

  it("normaliza public_id para maiúsculas", async () => {
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER);
    mockCreateCheckout.mockResolvedValueOnce({
      checkoutUrl: "https://checkout.infinitepay.io/abc",
    });
    mockCreatePayment.mockResolvedValueOnce({} as Awaited<ReturnType<typeof createPayment>>);

    await POST(new Request("http://localhost"), makeParams("abc12"));
    expect(mockFindOrder).toHaveBeenCalledWith("ABC12");
  });

  it("retorna 500 se InfinitePay falhar", async () => {
    mockFindOrder.mockResolvedValueOnce(PENDING_ORDER);
    mockCreateCheckout.mockRejectedValueOnce(new Error("Timeout"));

    const res = await POST(new Request("http://localhost"), makeParams("ABC12"));
    expect(res.status).toBe(500);
  });
});
