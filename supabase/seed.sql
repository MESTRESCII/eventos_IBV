-- Seed data for local development only.
-- Applied automatically by: npx supabase db reset

insert into public.products (name, description, price, stock, active)
values
  ('Coxinha',        'Coxinha de frango cremoso',          5.00,  50, true),
  ('Esfiha',         'Esfiha de carne aberta',              4.50,  40, true),
  ('Pão de Queijo',  'Pão de queijo mineiro (unidade)',     3.00, 100, true),
  ('Brigadeiro',     'Brigadeiro tradicional (unidade)',    4.00,  60, true),
  ('Suco de Laranja','Suco natural 300 ml',                 8.00,  30, true),
  ('Água Mineral',   'Garrafa 500 ml',                      3.50,  80, true);
