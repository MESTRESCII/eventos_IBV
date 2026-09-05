-- Seed data for local development only.
-- Applied automatically by: npx supabase db reset

insert into public.products (name, description, price, stock, active)
values
  ('Coxinha',        'Coxinha de frango cremoso',          5.00,  999, true),
  ('Esfiha',         'Esfiha de carne aberta',              4.50,  999, true),
  ('Pão de Queijo',  'Pão de queijo mineiro (unidade)',     3.00,  999, true),
  ('Brigadeiro',     'Brigadeiro tradicional (unidade)',    4.00,  999, true),
  ('Suco de Laranja','Suco natural 300 ml',                 8.00,  999, true),
  ('Água Mineral',   'Garrafa 500 ml',                      3.50,  999, true);
