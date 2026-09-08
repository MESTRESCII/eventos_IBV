import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/libs/supabase", () => ({
  getSupabaseClient: vi.fn(),
}));
vi.mock("@/db/repositories/orders.repository", () => ({
  findOrderByPublicId: vi.fn(),
}));
vi.mock("@/db/repositories/payments.repository", () => ({
  createPayment: vi.fn(),
}));
vi.mock("@/libs/payment/infinitepay/client", () => ({
  createCheckout: vi.fn(),
}));

import { getSupabaseClient } from "@/libs/supabase";
import { findOrderByPublicId } from "@/db/repositories/orders.repository";
import { createPayment } from "@/db/repositories/payments.repository";
import { createCheckout } from "@/libs/payment/infinitepay/client";
import { POST } from "@/app/api/checkout/pay-now/route";

const mockGetSupabase = vi.mocked(getSupabaseClient);
const mockFindOrder = vi.mocked(findOrderByPublicId);
const mockCreatePayment = vi.mocked(createPayment);
const mockCreateCheckout = vi.mocked(createCheckout);

const VALID_BODY = {
  customer_name: "João Silva",
  idempotency_key: "key-abc-123",
  items: [{ product_id: "550e8400-e29b-41d4-a716-446655440000", quantity: 2 }],
};

const MOCK_ORDER = {
  id: "uuid-order-1",
  public_id: "XY123",
  customer_name: "João Silva",
  pickup_date: "2026-09-26",
  total_amount: "20.00",
  payment_status: "AWAITING_PAYMENT",
  order_status: "CREATED",
  payment_id: null,
  paid_at: null,
  ready_at: null,
  delivered_at: null,
  delivered_by: null,
  created_at: "2026-09-08T00:00:00Z",
  items: [
    {
      id: "item-1",
      product_name: "Coxinha",
      quantity: 2,
      unit_price: "10.00",
      subtotal: "20.00",
    },
  ],
};

function makeRpcMock(result: Record<string, unknown>) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: result, error: null }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INFINITEPAY_WEBHOOK_TOKEN = "test-token";
  process.env.BASE_URL = "http://localhost:3000";
});

describe("POST /api/checkout/pay-now", () => {
  it("retorna 500 se INFINITEPAY_WEBHOOK_TOKEN não configurado", async () => {
    delete process.env.INFINITEPAY_WEBHOOK_TOKEN;
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(res.status).toBe(500);
  });

  it("retorna 400 com JSON inválido", async () => {
    const res = await POST(new Request("http://localhost", { method: "POST", body: "não é json" }));
    expect(res.status).toBe(400);
  });

  it("retorna 400 com dados inválidos (nome curto)", async () => {
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ...VALID_BODY, customer_name: "AB" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("cria pedido AWAITING_PAYMENT, checkout e retorna checkout_url", async () => {
    mockGetSupabase.mockReturnValue(
      makeRpcMock({
        order_id: "uuid-order-1",
        public_id: "XY123",
        total_amount: 20,
        idempotent: false,
      }) as unknown as ReturnType<typeof getSupabaseClient>,
    );
    mockFindOrder.mockResolvedValueOnce(MOCK_ORDER);
    mockCreateCheckout.mockResolvedValueOnce({
      checkoutUrl: "https://checkout.infinitepay.io/xyz",
    });
    mockCreatePayment.mockResolvedValueOnce({} as Awaited<ReturnType<typeof createPayment>>);

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkout_url).toBe("https://checkout.infinitepay.io/xyz");
    expect(body.public_id).toBe("XY123");

    // Verifica que o RPC foi chamado com AWAITING_PAYMENT
    const rpcCall = mockGetSupabase.mock.results[0].value.rpc;
    expect(rpcCall).toHaveBeenCalledWith(
      "create_order",
      expect.objectContaining({ p_payment_status: "AWAITING_PAYMENT" }),
    );

    // Verifica itens em centavos para InfinitePay
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNsu: "XY123",
        items: [{ description: "Coxinha", quantity: 2, priceInCents: 1000 }],
      }),
    );
  });

  it("retorna 409 se estoque insuficiente", async () => {
    mockGetSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Estoque insuficiente para: Coxinha" },
      }),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(res.status).toBe(409);
  });

  it("retorna 500 se InfinitePay falhar", async () => {
    mockGetSupabase.mockReturnValue(
      makeRpcMock({
        order_id: "uuid-order-1",
        public_id: "XY123",
        total_amount: 20,
        idempotent: false,
      }) as unknown as ReturnType<typeof getSupabaseClient>,
    );
    mockFindOrder.mockResolvedValueOnce(MOCK_ORDER);
    mockCreateCheckout.mockRejectedValueOnce(new Error("Timeout InfinitePay"));

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(VALID_BODY),
      }),
    );
    expect(res.status).toBe(500);
  });
});
