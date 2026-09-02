import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: text("name").notNull(),

    description: text("description"),

    price: numeric("price", {
      precision: 10,
      scale: 2,
    }).notNull(),

    stock: integer("stock").notNull().default(0),

    active: boolean("active").notNull().default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("products_active_idx").on(table.active)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    publicId: text("public_id").notNull().unique(),

    customerName: text("customer_name").notNull(),

    customerEmail: text("customer_email"),

    pickupDate: date("pickup_date").notNull(),

    totalAmount: numeric("total_amount", {
      precision: 10,
      scale: 2,
    }).notNull(),

    paymentStatus: text("payment_status").notNull().default("PENDING"),

    orderStatus: text("order_status").notNull().default("CREATED"),

    paymentId: text("payment_id"),

    idempotencyKey: text("idempotency_key").unique(),

    paidAt: timestamp("paid_at", {
      withTimezone: true,
    }),

    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
    }),

    deliveredBy: text("delivered_by"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("orders_payment_status_idx").on(table.paymentStatus),
    index("orders_order_status_idx").on(table.orderStatus),
    index("orders_pickup_date_idx").on(table.pickupDate),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, {
        onDelete: "cascade",
      }),

    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),

    productName: text("product_name").notNull(),

    unitPrice: numeric("unit_price", {
      precision: 10,
      scale: 2,
    }).notNull(),

    quantity: integer("quantity").notNull(),

    subtotal: numeric("subtotal", {
      precision: 10,
      scale: 2,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("order_items_order_id_idx").on(table.orderId)],
);
