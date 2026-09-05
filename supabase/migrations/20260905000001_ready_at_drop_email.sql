-- Migration: adiciona ready_at em orders, remove customer_email
-- e atualiza a função create_order para não receber e-mail.

-- 1. Adicionar coluna ready_at
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

-- 2. Remover coluna customer_email (já limpa no banco)
ALTER TABLE orders DROP COLUMN IF EXISTS customer_email;

-- 3. Dropar assinatura antiga (com p_customer_email) para evitar sobrecarga
DROP FUNCTION IF EXISTS create_order(TEXT, TEXT, DATE, TEXT, JSONB);

-- 4. Criar nova versão sem e-mail
CREATE OR REPLACE FUNCTION create_order(
  p_customer_name      TEXT,
  p_pickup_date        DATE,
  p_idempotency_key    TEXT,
  p_items              JSONB  -- [{product_id: uuid, quantity: int}]
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id   UUID;
  v_public_id  TEXT;
  v_total      NUMERIC(10,2) := 0;
  v_item       JSONB;
  v_product    RECORD;
BEGIN
  -- Idempotência: retorna pedido já existente sem criar duplicata
  SELECT id, public_id INTO v_order_id, v_public_id
    FROM orders
   WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id',    v_order_id,
      'public_id',   v_public_id,
      'idempotent',  true
    );
  END IF;

  -- Gerar public_id curto (5 chars hex em maiúsculas, ex.: A7F92)
  v_public_id := upper(substring(encode(gen_random_bytes(4), 'hex'), 1, 5));

  -- Bloquear produtos, checar estoque e calcular total
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
      FROM products
     WHERE id = (v_item->>'product_id')::UUID
       AND active = true
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado: %', v_item->>'product_id';
    END IF;

    IF v_product.stock < (v_item->>'quantity')::INT THEN
      RAISE EXCEPTION 'Estoque insuficiente para: %', v_product.name;
    END IF;

    UPDATE products
       SET stock = stock - (v_item->>'quantity')::INT
     WHERE id = v_product.id;

    v_total := v_total + v_product.price * (v_item->>'quantity')::INT;
  END LOOP;

  -- Criar pedido
  INSERT INTO orders (
    public_id, customer_name, pickup_date,
    total_amount, payment_status, order_status, idempotency_key
  ) VALUES (
    v_public_id, p_customer_name, p_pickup_date,
    v_total, 'PENDING', 'CREATED', p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- Criar itens (snapshot histórico de nome e preço)
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
      FROM products
     WHERE id = (v_item->>'product_id')::UUID;

    INSERT INTO order_items (
      order_id, product_id, product_name, unit_price, quantity, subtotal
    ) VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.price,
      (v_item->>'quantity')::INT,
      v_product.price * (v_item->>'quantity')::INT
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'public_id',    v_public_id,
    'total_amount', v_total,
    'idempotent',   false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_order(TEXT, DATE, TEXT, JSONB) TO service_role;
