export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";
export type OrderStatus = "CREATED" | "READY" | "DELIVERED" | "CANCELLED";

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
} as const satisfies Record<PaymentStatus, PaymentStatus>;

export const ORDER_STATUS = {
  CREATED: "CREATED",
  READY: "READY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const satisfies Record<OrderStatus, OrderStatus>;
