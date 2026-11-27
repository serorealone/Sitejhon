-- ============================================================================
-- EstoquePro — Script SQL de Dados de Teste (Seed)
-- Projeto 3: Sistema de Controle de Estoque
--
-- Pode ser executado em um banco SQLite recém-criado pelo 01-schema.sql.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Usuários de teste (senhas com hash bcryptjs)
INSERT OR IGNORE INTO "usuarios" ("id", "nome", "email", "senha_hash", "papel", "ativo") VALUES
  (1, 'Ana Souza',   'admin@estoquepro.com',    '$2b$10$exemploHashAdminNaoUsarEmProducao000000000000000000', 'ADMIN',    1),
  (2, 'Carlos Lima', 'operador@estoquepro.com', '$2b$10$exemploHashOperadorNaoUsarEmProducao00000000000000', 'OPERADOR', 1);

-- 2. Categorias
INSERT OR IGNORE INTO "categorias" ("id", "nome", "descricao") VALUES
  (1, 'Bebidas',           'Águas, sucos, refrigerantes, café e chás'),
  (2, 'Alimentos',         'Alimentos não perecíveis, snacks e panificação'),
  (3, 'Higiene e Limpeza', 'Produtos de limpeza doméstica e higiene pessoal'),
  (4, 'Papelaria',         'Material de escritório e escolar'),
  (5, 'Eletrônicos',       'Acessórios e periféricos de informática'),
  (6, 'Ferramentas',       'Ferramentas manuais e materiais de manutenção');

-- 3. Produtos (com saldo inicial coerente com as movimentações abaixo)
INSERT OR IGNORE INTO "produtos" ("id", "nome", "descricao", "sku", "categoria_id", "quantidade", "estoque_minimo", "preco_custo", "preco_venda", "ativo") VALUES
  (1, 'Água Mineral 500ml (fardo c/ 12)', 'Água natural sem gás',               'BEB-0001', 1, 50, 12, 14.40, 21.90, 1),
  (2, 'Refrigerante Cola 2L',             'Garrafa 2 litros',                   'BEB-0002', 1,  8, 10,  5.20,  8.90, 1),
  (3, 'Arroz Branco Tipo 1 — 5kg',        'Arroz branco polido tipo 1',         'ALI-0003', 2, 25, 10, 22.50, 29.90, 1),
  (4, 'Detergente Neutro 500ml',          'Detergente líquido biodegradável',   'HIG-0002', 3,  0, 18,  1.85,  3.49, 1),
  (5, 'Resma Papel A4 75g',               'Resma com 500 folhas',               'PAP-0004', 4, 20, 10, 21.00, 32.90, 1),
  (6, 'Mouse Óptico USB 1200dpi',         'Mouse com fio 3 botões',             'ELE-0001', 5,  4,  6, 14.50, 24.90, 1),
  (7, 'Kit Chaves de Fenda 6 peças',      'Chaves isoladas 1000V',              'FER-0001', 6,  9,  4, 28.00, 45.90, 1);

-- 4. Movimentações de entrada e saída
INSERT OR IGNORE INTO "movimentacoes" ("id", "produto_id", "tipo", "quantidade", "motivo", "observacao", "saldo_resultante", "usuario_id") VALUES
  (1, 1, 'ENTRADA', 60, NULL,           'Compra fornecedor — carga inicial', 60, 1),
  (2, 1, 'SAIDA',   10, 'Venda',        'Venda balcão',                      50, 2),
  (3, 2, 'ENTRADA', 20, NULL,           'Compra fornecedor — carga inicial', 20, 1),
  (4, 2, 'SAIDA',   12, 'Venda',        'Pedido delivery',                    8, 2),
  (5, 3, 'ENTRADA', 30, NULL,           'Carga inicial',                     30, 1),
  (6, 3, 'SAIDA',    5, 'Venda',        'Venda balcão',                      25, 2),
  (7, 4, 'ENTRADA', 15, NULL,           'Carga inicial',                     15, 1),
  (8, 4, 'SAIDA',   15, 'Venda',        'Queima de estoque',                  0, 2),
  (9, 5, 'ENTRADA', 20, NULL,           'Reposição de estoque',              20, 1),
  (10, 6, 'ENTRADA', 10, NULL,          'Carga inicial',                     10, 1),
  (11, 6, 'SAIDA',   6, 'Uso interno',  'Equipamento de escritório',          4, 1),
  (12, 7, 'ENTRADA', 9, NULL,           'Carga inicial',                      9, 1);
