/**
 * EstoquePro — Serviço de produtos
 * Pesquisa por nome/SKU, filtro por categoria e situação, ordenação,
 * paginação, CRUD com regras de negócio e exclusão segura (histórico).
 */
import { db } from '@/lib/db'
import { ApiError, Paginacao, metaPaginacao } from '../lib/http'
import { ProdutoInput, ProdutoUpdateInput } from '../validators/schemas'

const COLUNAS_ORDENACAO: Record<string, string> = {
  nome: 'p.nome',
  quantidade: 'p.quantidade',
  preco_custo: 'p.preco_custo',
  preco_venda: 'p.preco_venda',
  criado_em: 'p.criado_em',
  sku: 'p.sku',
  categoria: 'c.nome',
}

/** Situação do estoque computada no SQL (mesma regra dos alertas). */
const SQL_SITUACAO = `CASE
  WHEN p.quantidade = 0 THEN 'SEM_ESTOQUE'
  WHEN p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo THEN 'BAIXO'
  ELSE 'NORMAL' END`

const SQL_CONDS_SITUACAO: Record<string, string> = {
  baixo: `(p.quantidade > 0 AND p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo)`,
  sem: `p.quantidade = 0`,
  normal: `(p.quantidade > 0 AND NOT (p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo))`,
}

export const produtosService = {
  async listar(params: {
    busca?: string
    sku?: string
    categoriaId?: number
    status?: string
    ativo?: string
    ordem?: string
    dir?: string
  } & Paginacao) {
    const { page, limit, offset } = params

    const condicoes: string[] = []
    const valores: (string | number)[] = []

    if (params.busca && params.busca.trim()) {
      condicoes.push('(p.nome LIKE ? OR p.descricao LIKE ?)')
      const b = `%${params.busca.trim()}%`
      valores.push(b, b)
    }
    if (params.sku && params.sku.trim()) {
      condicoes.push('p.sku LIKE ?')
      valores.push(`%${params.sku.trim().toUpperCase()}%`)
    }
    if (params.categoriaId && Number.isFinite(params.categoriaId)) {
      condicoes.push('p.categoria_id = ?')
      valores.push(params.categoriaId)
    }
    const status = (params.status ?? '').toLowerCase()
    if (SQL_CONDS_SITUACAO[status]) condicoes.push(SQL_CONDS_SITUACAO[status])

    // ativo: 'todos' | 'ativos' (default) | 'arquivados'
    const ativoFiltro = (params.ativo ?? 'ativos').toLowerCase()
    if (ativoFiltro === 'todos') {
      // sem filtro
    } else if (ativoFiltro === 'arquivados') {
      condicoes.push('p.ativo = 0')
    } else {
      condicoes.push('p.ativo = 1')
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''

    const ordem = COLUNAS_ORDENACAO[params.ordem ?? 'nome'] ?? COLUNAS_ORDENACAO.nome
    const dir = (params.dir ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    const totalRows = await db.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*) AS total
       FROM produtos p
       ${where}`,
      ...valores
    )
    const total = Number(totalRows[0]?.total ?? 0)

    const dados = await db.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.nome, p.descricao, p.sku, p.categoria_id AS categoriaId,
              c.nome AS categoriaNome, p.quantidade, p.estoque_minimo AS estoqueMinimo,
              p.preco_custo AS precoCusto, p.preco_venda AS precoVenda, p.ativo,
              p.criado_em AS criadoEm, p.atualizado_em AS atualizadoEm,
              ${SQL_SITUACAO} AS situacao
       FROM produtos p
       JOIN categorias c ON c.id = p.categoria_id
       ${where}
       ORDER BY ${ordem} ${dir}
       LIMIT ? OFFSET ?`,
      ...valores, limit, offset
    )

    return { dados: dados.map(normalizar), meta: metaPaginacao({ page, limit, offset }, total) }
  },

  async buscarPorId(id: number) {
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.nome, p.descricao, p.sku, p.categoria_id AS categoriaId,
              c.nome AS categoriaNome, p.quantidade, p.estoque_minimo AS estoqueMinimo,
              p.preco_custo AS precoCusto, p.preco_venda AS precoVenda, p.ativo,
              p.criado_em AS criadoEm, p.atualizado_em AS atualizadoEm,
              ${SQL_SITUACAO} AS situacao
       FROM produtos p
       JOIN categorias c ON c.id = p.categoria_id
       WHERE p.id = ?`,
      id
    )
    if (!rows[0]) throw new ApiError(404, 'Produto não encontrado.', 'NAO_ENCONTRADO')

    const estatisticas = await db.$queryRawUnsafe<any[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN quantidade END), 0) AS totalEntradas,
         COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade END), 0) AS totalSaidas,
         COUNT(*) AS movimentacoes,
         MAX(criado_em) AS ultimaMovimentacao
       FROM movimentacoes WHERE produto_id = ?`,
      id
    )
    const est = estatisticas[0]
    return {
      ...normalizar(rows[0]),
      estatisticas: {
        totalEntradas: Number(est.totalEntradas),
        totalSaidas: Number(est.totalSaidas),
        movimentacoes: Number(est.movimentacoes),
        ultimaMovimentacao: est.ultimaMovimentacao
          ? new Date(Number(est.ultimaMovimentacao)).toISOString()
          : null,
      },
    }
  },

  /**
   * Cria o produto; se houver quantidade inicial > 0, registra
   * automaticamente uma movimentação de ENTRADA (carga inicial),
   * garantindo histórico completo desde o primeiro dia.
   */
  async criar(input: ProdutoInput, usuarioId: number) {
    const categoria = await db.categoria.findUnique({ where: { id: input.categoriaId } })
    if (!categoria) throw new ApiError(400, 'Categoria informada não existe.', 'CATEGORIA_INVALIDA')

    await this.validarSkuUnico(input.sku)

    const criado = await db.$transaction(async (tx) => {
      const produto = await tx.produto.create({
        data: {
          nome: input.nome,
          descricao: input.descricao ? input.descricao : null,
          sku: input.sku,
          categoriaId: input.categoriaId,
          estoqueMinimo: input.estoqueMinimo,
          precoCusto: arredondar(input.precoCusto),
          precoVenda: arredondar(input.precoVenda),
          quantidade: input.quantidadeInicial ?? 0,
        },
      })
      if (input.quantidadeInicial && input.quantidadeInicial > 0) {
        await tx.movimentacao.create({
          data: {
            produtoId: produto.id,
            tipo: 'ENTRADA',
            quantidade: input.quantidadeInicial,
            observacao: 'Estoque inicial do cadastro',
            saldoResultante: input.quantidadeInicial,
            usuarioId,
          },
        })
      }
      return produto
    })
    return this.buscarPorId(criado.id)
  },

  /** SKU único case-insensitive (alinhado ao UNIQUE COLLATE NOCASE do DDL). */
  async validarSkuUnico(sku: string, idIgnorar?: number) {
    const rows = await db.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM produtos WHERE sku = ? COLLATE NOCASE ${idIgnorar ? 'AND id != ?' : ''} LIMIT 1`,
      ...(idIgnorar ? [sku, idIgnorar] : [sku])
    )
    if (rows[0]) throw new ApiError(409, `Já existe um produto com o SKU "${sku}".`, 'SKU_DUPLICADO')
  },

  /**
   * Atualiza dados cadastrais. A quantidade NÃO é editável aqui:
   * ela só muda por movimentações (entradas/saídas), preservando o histórico.
   */
  async atualizar(id: number, input: ProdutoUpdateInput) {
    const atual = await this.buscarPorId(id)
    if (input.categoriaId !== undefined) {
      const categoria = await db.categoria.findUnique({ where: { id: input.categoriaId } })
      if (!categoria) throw new ApiError(400, 'Categoria informada não existe.', 'CATEGORIA_INVALIDA')
    }
    if (input.sku) await this.validarSkuUnico(input.sku, id)

    await db.produto.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao || null } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.categoriaId !== undefined ? { categoriaId: input.categoriaId } : {}),
        ...(input.estoqueMinimo !== undefined ? { estoqueMinimo: input.estoqueMinimo } : {}),
        ...(input.precoCusto !== undefined ? { precoCusto: arredondar(input.precoCusto) } : {}),
        ...(input.precoVenda !== undefined ? { precoVenda: arredondar(input.precoVenda) } : {}),
      },
    })
    void atual
    return this.buscarPorId(id)
  },

  /**
   * Exclusão: produtos COM histórico não podem ser apagados —
   * são arquivados para preservar as movimentações (auditoria).
   */
  async excluir(id: number) {
    await this.buscarPorId(id)
    const movimentacoes = await db.movimentacao.count({ where: { produtoId: id } })
    if (movimentacoes > 0) {
      throw new ApiError(
        409,
        `Produto possui ${movimentacoes} movimentação(ões) no histórico. Use "arquivar" para retirá-lo da operação sem apagar o histórico.`,
        'PRODUTO_COM_HISTORICO',
        { movimentacoes, sugerirArquivamento: true }
      )
    }
    await db.produto.delete({ where: { id } })
  },

  /** Arquiva (ativa=false) ou desarquiva um produto. */
  async arquivar(id: number, arquivado: boolean) {
    await this.buscarPorId(id)
    const atualizado = await db.produto.update({ where: { id }, data: { ativo: !arquivado } })
    return { ...atualizado, situacao: undefined }
  },
}

function arredondar(v: number) {
  return Math.round(v * 100) / 100
}

function normalizar(r: any) {
  return {
    ...r,
    quantidade: Number(r.quantidade),
    estoqueMinimo: Number(r.estoqueMinimo),
    precoCusto: Number(r.precoCusto),
    precoVenda: Number(r.precoVenda),
    ativo: Number(r.ativo) === 1,
  }
}
