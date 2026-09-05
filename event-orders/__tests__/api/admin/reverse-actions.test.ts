import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/repositories/orders.repository", () => ({
  markOrderAsUnpaid: vi.fn(),
  markOrderAsUnready: vi.fn(),
  markOrderAsUndelivered: vi.fn(),
}));
vi.mock("@/libs/sheets", () => ({ updateOrderRow: vi.fn() }));

import {
  markOrderAsUnpaid,
  markOrderAsUnready,
  markOrderAsUndelivered,
} from "@/db/repositories/orders.repository";
import { POST as unpayPOST } from "@/app/api/admin/orders/[id]/unpay/route";
import { POST as unreadyPOST } from "@/app/api/admin/orders/[id]/unready/route";
import { POST as undeliverPOST } from "@/app/api/admin/orders/[id]/undeliver/route";

const mockUnpaid = vi.mocked(markOrderAsUnpaid);
const mockUnready = vi.mocked(markOrderAsUnready);
const mockUndeliver = vi.mocked(markOrderAsUndelivered);

const MOCK_ORDER = {
  id: "uuid-1",
  public_id: "ABC12",
  customer_name: "João",
  pickup_date: "2026-09-26",
  total_amount: "10.00",
  payment_status: "PENDING",
  order_status: "CREATED",
  payment_id: null,
  paid_at: null,
  ready_at: null,
  delivered_at: null,
  delivered_by: null,
  created_at: "2026-09-05T00:00:00Z",
  items: [],
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/admin/orders/[id]/unpay", () => {
  it("retorna 200 e o pedido atualizado", async () => {
    mockUnpaid.mockResolvedValueOnce(MOCK_ORDER);
    const res = await unpayPOST(new Request("http://localhost"), makeParams("ABC12"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("retorna 404 se pedido não encontrado ou status incompatível", async () => {
    mockUnpaid.mockResolvedValueOnce(null);
    const res = await unpayPOST(new Request("http://localhost"), makeParams("XXXXX"));
    expect(res.status).toBe(404);
  });

  it("normaliza o id para maiúsculas", async () => {
    mockUnpaid.mockResolvedValueOnce(MOCK_ORDER);
    await unpayPOST(new Request("http://localhost"), makeParams("abc12"));
    expect(mockUnpaid).toHaveBeenCalledWith("ABC12");
  });
});

describe("POST /api/admin/orders/[id]/unready", () => {
  it("retorna 200 e o pedido atualizado", async () => {
    mockUnready.mockResolvedValueOnce(MOCK_ORDER);
    const res = await unreadyPOST(new Request("http://localhost"), makeParams("ABC12"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("retorna 404 se pedido não encontrado ou status incompatível", async () => {
    mockUnready.mockResolvedValueOnce(null);
    const res = await unreadyPOST(new Request("http://localhost"), makeParams("XXXXX"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/orders/[id]/undeliver", () => {
  it("retorna 200 e o pedido atualizado", async () => {
    mockUndeliver.mockResolvedValueOnce(MOCK_ORDER);
    const res = await undeliverPOST(new Request("http://localhost"), makeParams("ABC12"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("retorna 404 se pedido não encontrado ou status incompatível", async () => {
    mockUndeliver.mockResolvedValueOnce(null);
    const res = await undeliverPOST(new Request("http://localhost"), makeParams("XXXXX"));
    expect(res.status).toBe(404);
  });
});
