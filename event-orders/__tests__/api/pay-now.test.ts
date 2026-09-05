import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/repositories/orders.repository", () => ({
  markOrderAsPaid: vi.fn(),
}));
vi.mock("@/libs/sheets", () => ({ updateOrderRow: vi.fn() }));

import { markOrderAsPaid } from "@/db/repositories/orders.repository";
import { POST } from "@/app/api/orders/[public_id]/pay-now/route";

const mockMarkPaid = vi.mocked(markOrderAsPaid);

const MOCK_ORDER = {
  id: "uuid-1",
  public_id: "ABC12",
  customer_name: "João",
  pickup_date: "2026-09-26",
  total_amount: "10.00",
  payment_status: "PAID",
  order_status: "CREATED",
  payment_id: null,
  paid_at: "2026-09-05T12:00:00Z",
  ready_at: null,
  delivered_at: null,
  delivered_by: null,
  created_at: "2026-09-05T00:00:00Z",
  items: [],
};

function makeParams(public_id: string) {
  return { params: Promise.resolve({ public_id }) };
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/orders/[public_id]/pay-now", () => {
  it("marca o pedido como pago e retorna 200", async () => {
    mockMarkPaid.mockResolvedValueOnce(MOCK_ORDER);
    const res = await POST(new Request("http://localhost"), makeParams("ABC12"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.order.payment_status).toBe("PAID");
  });

  it("retorna 404 se pedido não encontrado ou já pago", async () => {
    mockMarkPaid.mockResolvedValueOnce(null);
    const res = await POST(new Request("http://localhost"), makeParams("XXXXX"));
    expect(res.status).toBe(404);
  });

  it("normaliza public_id para maiúsculas", async () => {
    mockMarkPaid.mockResolvedValueOnce(MOCK_ORDER);
    await POST(new Request("http://localhost"), makeParams("abc12"));
    expect(mockMarkPaid).toHaveBeenCalledWith("ABC12");
  });
});
