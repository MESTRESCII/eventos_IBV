create extension if not exists "pgcrypto";

create table public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    price numeric(10, 2) not null,
    stock integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint products_price_non_negative
        check (price >= 0),

    constraint products_stock_non_negative
        check (stock >= 0)
);

create table public.orders (
    id uuid primary key default gen_random_uuid(),
    public_id text not null unique,
    customer_name text not null,
    customer_email text,
    pickup_date date not null,

    total_amount numeric(10, 2) not null,

    payment_status text not null default 'PENDING',
    order_status text not null default 'CREATED',

    payment_id text,
    idempotency_key text unique,

    paid_at timestamptz,
    delivered_at timestamptz,
    delivered_by text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint orders_total_non_negative
        check (total_amount >= 0)
);

create table public.order_items (
    id uuid primary key default gen_random_uuid(),

    order_id uuid not null
        references public.orders(id)
        on delete cascade,

    product_id uuid not null
        references public.products(id),

    product_name text not null,
    unit_price numeric(10, 2) not null,
    quantity integer not null,
    subtotal numeric(10, 2) not null,

    created_at timestamptz not null default now(),

    constraint order_items_quantity_positive
        check (quantity > 0),

    constraint order_items_unit_price_non_negative
        check (unit_price >= 0),

    constraint order_items_subtotal_non_negative
        check (subtotal >= 0)
);

create index orders_public_id_idx
    on public.orders(public_id);

create index orders_payment_status_idx
    on public.orders(payment_status);

create index orders_order_status_idx
    on public.orders(order_status);

create index order_items_order_id_idx
    on public.order_items(order_id);