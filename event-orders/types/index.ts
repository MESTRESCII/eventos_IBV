export type PaymentStatus = "PENDING" | "AWAITING_PAYMENT" | "PAID" | "FAILED" | "EXPIRED";

export type OrderStatus = "CREATED" | "READY" | "DELIVERED" | "CANCELLED";

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
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

export type ProductCategory = "Lanches" | "Salgados & Porções" | "Doces" | "Bebidas & Sucos";

/** Ordem de exibição das categorias no cardápio. */
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "Lanches",
  "Salgados & Porções",
  "Doces",
  "Bebidas & Sucos",
];

/** Emoji usado como placeholder de foto enquanto não há image_url. */
export const CATEGORY_PLACEHOLDER: Record<string, string> = {
  Lanches: "🍔",
  "Salgados & Porções": "🌽",
  Doces: "🍬",
  "Bebidas & Sucos": "🥤",
};
