import { describe, it, expect } from "vitest";
import { PAYMENT_STATUS, ORDER_STATUS } from "@/types";

describe("PAYMENT_STATUS", () => {
  it("contains all required payment status values", () => {
    expect(PAYMENT_STATUS.PENDING).toBe("PENDING");
    expect(PAYMENT_STATUS.PAID).toBe("PAID");
    expect(PAYMENT_STATUS.FAILED).toBe("FAILED");
    expect(PAYMENT_STATUS.EXPIRED).toBe("EXPIRED");
  });

  it("has exactly 4 statuses", () => {
    expect(Object.keys(PAYMENT_STATUS)).toHaveLength(4);
  });
});

describe("ORDER_STATUS", () => {
  it("contains all required order status values", () => {
    expect(ORDER_STATUS.CREATED).toBe("CREATED");
    expect(ORDER_STATUS.READY).toBe("READY");
    expect(ORDER_STATUS.DELIVERED).toBe("DELIVERED");
    expect(ORDER_STATUS.CANCELLED).toBe("CANCELLED");
  });

  it("has exactly 4 statuses", () => {
    expect(Object.keys(ORDER_STATUS)).toHaveLength(4);
  });
});
