-- Migration: cancelamento de pedido pendente pelo painel admin
--
-- Só cancela pedidos PENDING (ainda não pagos). Restaura o estoque dos
-- itens do pedido e marca order_status = 'CANCELLED'. Pedidos cancelados
-- somem das abas do painel (ver listAllOrders no repository).

CREATE OR REPLACE FUNCTION cancel_order(p_public_id TEXT) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order
    FROM orders
   WHERE public_id = p_public_id
     AND payment_status = 'PENDING'
     AND order_status <> 'CANCELLED'
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('cancelled', false);
  END IF;

  -- Devolve ao estoque a quantidade de cada item do pedido
  UPDATE products p
     SET stock = p.stock + oi.quantity
    FROM order_items oi
   WHERE oi.order_id = v_order.id
     AND oi.product_id = p.id;

  UPDATE orders
     SET order_status = 'CANCELLED'
   WHERE id = v_order.id;

  RETURN jsonb_build_object('cancelled', true, 'order_id', v_order.id);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_order(TEXT) TO service_role;
