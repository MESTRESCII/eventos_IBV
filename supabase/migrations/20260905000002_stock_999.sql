-- Atualiza estoque de todos os produtos para 999.
-- Política do evento: não monitorar estoque; todos os itens disponíveis.
UPDATE products SET stock = 999 WHERE active = true;
