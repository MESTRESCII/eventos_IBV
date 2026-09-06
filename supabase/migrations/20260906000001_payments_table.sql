-- Tabela de pagamentos InfinitePay
-- Registra cada tentativa de checkout e a confirmação via webhook + payment_check.

CREATE TABLE public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'infinitepay',

  -- Identificador do pedido enviado à InfinitePay (= public_id do order)
  order_nsu       TEXT NOT NULL,

  -- Retornados pela InfinitePay após pagamento confirmado
  transaction_nsu TEXT UNIQUE,
  invoice_slug    TEXT,

  -- Valores em reais (NUMERIC, não centavos — consistente com o resto do sistema)
  amount          NUMERIC(10,2) NOT NULL,
  paid_amount     NUMERIC(10,2),

  payment_method  TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  receipt_url     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at         TIMESTAMPTZ,

  CONSTRAINT payments_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT payments_status_valid CHECK (status IN ('PENDING', 'PAID', 'FAILED'))
);

CREATE INDEX payments_order_id_idx  ON public.payments(order_id);
CREATE INDEX payments_order_nsu_idx ON public.payments(order_nsu);

COMMENT ON TABLE public.payments IS
  'Registra pagamentos InfinitePay. transaction_nsu é UNIQUE para garantir idempotência no webhook.';
