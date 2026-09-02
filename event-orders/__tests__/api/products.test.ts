import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/products/route";

vi.mock("@/db/repositories/products.repository", () => ({
  findActiveProducts: vi.fn(),
}));

import { findActiveProducts } from "@/db/repositories/products.repository";

const mockFindActiveProducts = vi.mocked(findActiveProducts);

const MOCK_PRODUCTS = [
  {
    id: "uuid-1",
    name: "Hambúrguer",
    description: "Hambúrguer artesanal",
    price: "15.00",
    stock: 100,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "uuid-2",
    name: "Batata",
    description: "Porção de batata frita",
    price: "10.00",
    stock: 100,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

describe("GET /api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active products as JSON with status 200", async () => {
    mockFindActiveProducts.mockResolvedValueOnce(MOCK_PRODUCTS);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("Hambúrguer");
  });

  it("returns 500 when the database throws", async () => {
    mockFindActiveProducts.mockRejectedValueOnce(new Error("connection refused"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to fetch products");
  });

  it("returns an empty array when there are no active products", async () => {
    mockFindActiveProducts.mockResolvedValueOnce([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
