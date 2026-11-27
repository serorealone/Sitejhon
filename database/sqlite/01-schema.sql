-- ============================================================================
-- EstoquePro — Modelo Físico (SQLite)
-- Projeto 3: Sistema de Controle de Estoque
--
-- Inclui:
--   - Integridade referencial (PRAGMA foreign_keys = ON e FOREIGN KEY RESTRICT)
--   - Restrições NOT NULL, UNIQUE, PRIMARY KEY e CHECK
--   - Índices para otimização de buscas, filtros e ordenação
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- Tabela: usuarios
-- Armazena os usuários do sistema (administradores e operadores).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "usuarios" (
    "id"            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome"          TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "senha_hash"    TEXT NOT NULL,
    "papel"         TEXT NOT NULL DEFAULT 'OPERADOR' CHECK ("papel" IN ('ADMIN', 'OPERADOR')),
    "ativo"         BOOLEAN NOT NULL DEFAULT 1 CHECK ("ativo" IN (0, 1)),
    "criado_em"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_key" ON "usuarios"("email");

-- ----------------------------------------------------------------------------
-- Tabela: categorias
-- Agrupa os produtos da loja (relacionamento 1:N com produtos).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "categorias" (
    "id"            INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome"          TEXT NOT NULL COLLATE NOCASE,
    "descricao"     TEXT,
    "criado_em"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "categorias_nome_key" ON "categorias"("nome");

-- ----------------------------------------------------------------------------
-- Tabela: produtos
-- Catálogo de produtos com SKU único, estoque atual e limites.
-- Restrições CHECK garantem que quantidade, estoque_minimo e preços >= 0.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "produtos" (
    "id"             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome"           TEXT NOT NULL,
    "descricao"      TEXT,
    "sku"            TEXT NOT NULL COLLATE NOCASE,
    "categoria_id"   INTEGER NOT NULL,
    "quantidade"     INTEGER NOT NULL DEFAULT 0 CHECK ("quantidade" >= 0),
    "estoque_minimo" INTEGER NOT NULL DEFAULT 0 CHECK ("estoque_minimo" >= 0),
    "preco_custo"    REAL NOT NULL DEFAULT 0 CHECK ("preco_custo" >= 0),
    "preco_venda"    REAL NOT NULL DEFAULT 0 CHECK ("preco_venda" >= 0),
    "ativo"          BOOLEAN NOT NULL DEFAULT 1 CHECK ("ativo" IN (0, 1)),
    "criado_em"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "produtos_categoria_id_fkey"
        FOREIGN KEY ("categoria_id") REFERENCES "categorias" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "produtos_sku_key" ON "produtos"("sku");
CREATE INDEX IF NOT EXISTS "produtos_categoria_id_idx" ON "produtos"("categoria_id");
CREATE INDEX IF NOT EXISTS "produtos_nome_idx" ON "produtos"("nome");

-- ----------------------------------------------------------------------------
-- Tabela: movimentacoes
-- Histórico imutável de entradas e saídas de estoque (1:N com produtos e usuarios).
-- Restrições CHECK impedem movimentações com quantidade <= 0 e tipos inválidos.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "movimentacoes" (
    "id"               INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produto_id"       INTEGER NOT NULL,
    "tipo"             TEXT NOT NULL CHECK ("tipo" IN ('ENTRADA', 'SAIDA')),
    "quantidade"       INTEGER NOT NULL CHECK ("quantidade" > 0),
    "motivo"           TEXT,
    "observacao"       TEXT,
    "saldo_resultante" INTEGER NOT NULL CHECK ("saldo_resultante" >= 0),
    "usuario_id"       INTEGER NOT NULL,
    "criado_em"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentacoes_produto_id_fkey"
        FOREIGN KEY ("produto_id") REFERENCES "produtos" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimentacoes_usuario_id_fkey"
        FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "movimentacoes_produto_id_idx" ON "movimentacoes"("produto_id");
CREATE INDEX IF NOT EXISTS "movimentacoes_tipo_idx" ON "movimentacoes"("tipo");
CREATE INDEX IF NOT EXISTS "movimentacoes_criado_em_idx" ON "movimentacoes"("criado_em");
