-- Migration: categoria e imagem por produto
--
-- Permite organizar o cardápio em seções (Lanches, Porções, Doces, Bebidas)
-- e exibir uma foto por produto. image_url fica nulo até termos fotos reais —
-- a UI usa um placeholder por categoria enquanto isso.

ALTER TABLE products
  ADD COLUMN category text NOT NULL DEFAULT 'Lanches',
  ADD COLUMN image_url text;

CREATE INDEX products_category_idx ON products (category);
