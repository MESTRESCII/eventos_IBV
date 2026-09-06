-- Seed data for local development only.
-- Preços em R$1,00 (100 centavos) para minimizar custo de testes reais com InfinitePay.
-- Applied automatically by: npx supabase db reset

INSERT INTO public.products (name, description, price, stock, active)
VALUES
  ('Coxinha',        'Coxinha de frango cremoso',         1.00, 999, true),
  ('Esfiha',         'Esfiha de carne aberta',            1.00, 999, true),
  ('Pão de Queijo',  'Pão de queijo mineiro (unidade)',   1.00, 999, true),
  ('Brigadeiro',     'Brigadeiro tradicional (unidade)',  1.00, 999, true),
  ('Suco de Laranja','Suco natural 300 ml',               1.00, 999, true),
  ('Água Mineral',   'Garrafa 500 ml',                    1.00, 999, true);
