-- ============================================================================
-- EstoquePro — Consultas SQL Relevantes (Projeto 3: Controle de Estoque)
--
-- Demonstra: SELECT, INSERT, UPDATE, DELETE, JOIN, LEFT JOIN, WHERE,
--            ORDER BY, GROUP BY, COUNT, SUM e filtros combinados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CONSULTA 1: Consultar produtos com sua categoria e situação de estoque
-- (JOIN, CASE, filtros por nome/categoria e ordenação)
-- ----------------------------------------------------------------------------
SELECT
    p.id,
    p.sku,
    p.nome AS produto,
    c.nome AS categoria,
    p.quantidade,
    p.estoque_minimo,
    CASE
        WHEN p.quantidade = 0 THEN 'SEM_ESTOQUE'
        WHEN p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo THEN 'BAIXO'
        ELSE 'NORMAL'
    END AS situacao
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id
WHERE p.ativo = 1
ORDER BY c.nome ASC, p.nome ASC;

-- ----------------------------------------------------------------------------
-- CONSULTA 2: Listar produtos com estoque baixo ou zerado (Alertas)
-- (JOIN, filtros combinados com AND/OR e ordenação por criticidade)
-- ----------------------------------------------------------------------------
SELECT
    p.id,
    p.sku,
    p.nome AS produto,
    c.nome AS categoria,
    p.quantidade,
    p.estoque_minimo
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id
WHERE p.ativo = 1
  AND (p.quantidade = 0 OR (p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo))
ORDER BY p.quantidade ASC, p.nome ASC;

-- ----------------------------------------------------------------------------
-- CONSULTA 3: Histórico de movimentações por produto (com usuário e categoria)
-- (Múltiplos JOINs, filtro por produto e ordenação cronológica decrescente)
-- ----------------------------------------------------------------------------
SELECT
    m.id,
    m.criado_em,
    m.tipo,
    p.sku,
    p.nome AS produto,
    c.nome AS categoria,
    m.quantidade,
    m.saldo_resultante,
    m.motivo,
    u.nome AS responsavel
FROM movimentacoes m
JOIN produtos p ON p.id = m.produto_id
JOIN categorias c ON c.id = p.categoria_id
JOIN usuarios u ON u.id = m.usuario_id
WHERE p.id = 1
ORDER BY m.criado_em DESC, m.id DESC;

-- ----------------------------------------------------------------------------
-- CONSULTA 4: Consolidado de produtos, unidades e valor em estoque por categoria
-- (LEFT JOIN, GROUP BY, COUNT, SUM e cálculo de valor total)
-- ----------------------------------------------------------------------------
SELECT
    c.id,
    c.nome AS categoria,
    COUNT(p.id) AS total_produtos,
    COALESCE(SUM(p.quantidade), 0) AS total_unidades,
    ROUND(COALESCE(SUM(p.quantidade * p.preco_custo), 0), 2) AS valor_total_custo
FROM categorias c
LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo = 1
GROUP BY c.id, c.nome
ORDER BY valor_total_custo DESC, c.nome ASC;

-- ----------------------------------------------------------------------------
-- CONSULTA 5: Ranking de produtos mais movimentados (Entradas x Saídas)
-- (JOIN, GROUP BY, SUM condicional com CASE e COUNT)
-- ----------------------------------------------------------------------------
SELECT
    p.id,
    p.sku,
    p.nome AS produto,
    c.nome AS categoria,
    COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade END), 0) AS total_entradas,
    COALESCE(SUM(CASE WHEN m.tipo = 'SAIDA' THEN m.quantidade END), 0) AS total_saidas,
    COALESCE(SUM(m.quantidade), 0) AS total_movimentado,
    COUNT(m.id) AS qtd_movimentacoes
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id
LEFT JOIN movimentacoes m ON m.produto_id = p.id
GROUP BY p.id, p.sku, p.nome, c.nome
ORDER BY total_movimentado DESC, qtd_movimentacoes DESC;

-- ----------------------------------------------------------------------------
-- OPERAÇÕES DML (INSERT, UPDATE, DELETE) — Exemplos de uso
-- ----------------------------------------------------------------------------

-- INSERT: Registrar uma entrada de estoque (dentro de transação na API)
-- INSERT INTO movimentacoes (produto_id, tipo, quantidade, observacao, saldo_resultante, usuario_id)
-- VALUES (1, 'ENTRADA', 10, 'Reposição de fornecedor', 60, 1);

-- UPDATE: Atualizar quantidade disponível do produto após a movimentação
-- UPDATE produtos SET quantidade = quantidade + 10, atualizado_em = CURRENT_TIMESTAMP WHERE id = 1;

-- DELETE: Excluir categoria apenas se não possuir produtos vinculados (FK RESTRICT)
-- DELETE FROM categorias WHERE id = 6;
