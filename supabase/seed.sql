-- Seed data for local development only.
-- Preços em R$1,00 (100 centavos) para minimizar custo de testes reais com InfinitePay.
-- Applied automatically by: npx supabase db reset

INSERT INTO public.products (name, description, price, stock, category, active) VALUES
  -- Lanches
  ('Ungido Básico',  'Pão de Brioche, Hambúrguer 120g, Queijo Mussarela, Alface e Tomate', 1.00, 999, 'Lanches', true),
  ('Ungido Premium', 'Pão de Brioche, Hambúrguer 120g, Queijo Mussarela, Bacon em Fatias, Alface e Tomate', 1.00, 999, 'Lanches', true),
  ('Caminho da Glória', 'Pão de Brioche, Hambúrguer 120g, Queijo Cheddar, Cebola Caramelizada', 1.00, 999, 'Lanches', true),
  ('Terra Prometida', 'Pão de Brioche, Hambúrguer 120g, Queijo Cheddar, Bacon em Fatias e Cebola Caramelizada', 1.00, 999, 'Lanches', true),

  -- Salgados & Porções
  ('Milho Cozido', NULL, 1.00, 999, 'Salgados & Porções', true),
  ('Pamonha Salgada com Queijo', NULL, 1.00, 999, 'Salgados & Porções', true),

  -- Doces
  ('Pamonha Doce', NULL, 1.00, 999, 'Doces', true),
  ('Pamonha Doce com Queijo', NULL, 1.00, 999, 'Doces', true),
  ('Doce de Leite', NULL, 1.00, 999, 'Doces', true),
  ('Brigadeiro', NULL, 1.00, 999, 'Doces', true),
  ('Brigadeiro Branco de Ninho', NULL, 1.00, 999, 'Doces', true),
  ('Churros', NULL, 1.00, 999, 'Doces', true),
  ('Sorvete de Caldo de Cana', '130 ml', 1.00, 999, 'Doces', true),

  -- Bebidas & Sucos
  ('Suco 300ml', NULL, 1.00, 999, 'Bebidas & Sucos', true),
  ('Suco 500ml', NULL, 1.00, 999, 'Bebidas & Sucos', true);
