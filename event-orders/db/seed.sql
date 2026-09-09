-- Cardápio IBV 2026. Preços a R$1,00 para minimizar custo de testes reais
-- (ver decisão em memória de projeto) — ajustar antes do evento.
INSERT INTO products (name, description, price, stock, category, active) VALUES
  -- Lanches (cardápio real — Festa da Família)
  ('Ungido Básico',  'Pão de Brioche, Hambúrguer 120g, Queijo Mussarela, Alface e Tomate', 1.00, 999, 'Lanches', true),
  ('Ungido Premium', 'Pão de Brioche, Hambúrguer 120g, Queijo Mussarela, Bacon em Fatias, Alface e Tomate', 1.00, 999, 'Lanches', true),
  ('Caminho da Glória', 'Pão de Brioche, Hambúrguer 120g, Queijo Cheddar, Cebola Caramelizada', 1.00, 999, 'Lanches', true),
  ('Terra Prometida', 'Pão de Brioche, Hambúrguer 120g, Queijo Cheddar, Bacon em Fatias e Cebola Caramelizada', 1.00, 999, 'Lanches', true),

  -- Porções (placeholder — substituir pelo cardápio real antes do evento)
  ('Batata Frita', 'Porção de batata frita crocante', 1.00, 999, 'Porções', true),
  ('Anéis de Cebola', 'Porção de onion rings empanados', 1.00, 999, 'Porções', true),

  -- Doces (placeholder — substituir pelo cardápio real antes do evento)
  ('Churros', 'Churros com doce de leite', 1.00, 999, 'Doces', true),
  ('Brigadeiro', 'Brigadeiro gourmet', 1.00, 999, 'Doces', true),

  -- Bebidas (placeholder — substituir pelo cardápio real antes do evento)
  ('Coca-Cola Lata', 'Refrigerante 350ml', 1.00, 999, 'Bebidas', true),
  ('Água Mineral', 'Garrafa 500ml', 1.00, 999, 'Bebidas', true);
