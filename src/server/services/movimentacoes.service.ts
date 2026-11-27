/**
 * EstoquePro — Serviço de movimentações (entradas e saídas)
 * Regras críticas:
 *  - Operação ATÔMICA: atualização do estoque + registro do histórico
 *    ocorrem dentro de uma transação SQL interativa.
 *  - Quantidade deve ser positiva; saída nunca pode exceder o estoque.
 *  - Saldo resultante é gravado em cada registro (auditoria).
 *  - Operações simultâneas são serializadas pela transação — o estoque
 *    é relido DENTRO da transação antes de aplicar a alteração.
 */
import { db } from '@/lib/db'
import { ApiError, Paginacao, metaPaginacao } from '../lib/http'
import { MovimentacaoInput } from '../validators/schemas'

const COLUNAS_ORDENACAO: Record<string, string> = {
  criado_em: 'm.criado_em',
  id: 'm.id',
  quantidade: 'm.quantidade',
}

export const movimentacoesService = {
  /**
   * Registra ENTRADA ou SAÍDA de forma atômica (transação interativa).
   */
  async registrar(input: MovimentacaoInput, usuarioId: number) {
    const resultado = await db.$transaction(async (tx) => {
      // Relê o estoque DENTRO da transação para evitar inconsistências
      // com operações simultâneas (serialização de escritas do SQLite).
      const rows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, nome, quantidade, ativo FROM produtos WHERE id = ?`,
        input.produtoId
      )
      const produto = rows[0]
      if (!produto) throw new ApiError(404, 'Produto não encontrado.', 'NAO_ENCONTRADO')
      if (Number(produto.ativo) !== 1) {
        throw new ApiError(409, 'Produto arquivado não pode receber movimentações.', 'PRODUTO_ARQUIVADO')
      }

      const estoqueAtual = Number(produto.quantidade)
      const quantidade = input.quantidade
      const novoEstoque = input.tipo === 'ENTRADA' ? estoqueAtual + quantidade : estoqueAtual - quantidade

      if (novoEstoque < 0) {
        throw new ApiError(
          422,
          `Saída bloqueada: estoque disponível é de ${estoqueAtual} unidade(s) — solicitação de ${quantidade}.`,
          'ESTOQUE_INSUFICIENTE',
          { estoqueAtual, solicitado: quantidade }
        )
      }

      // Atualização do estoque (atomicidade garantida pela transação)
      await tx.$executeRawUnsafe(
        `UPDATE produtos SET quantidade = ?, atualizado_em = ? WHERE id = ?`,
        novoEstoque,
        Date.now(),
        input.produtoId
      )

      // Registro imutável no histórico (epoch ms — padrão das datas do banco)
      const inserido = await tx.$queryRawUnsafe<any[]>(
        `INSERT INTO movimentacoes
           (produto_id, tipo, quantidade, motivo, observacao, saldo_resultante, usuario_id, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id, criado_em`,
        input.produtoId,
        input.tipo,
        quantidade,
        input.motivo ? input.motivo : null,
        input.observacao ? input.observacao : null,
        novoEstoque,
        usuarioId,
        Date.now()
      )

      return {
        id: Number(inserido[0].id),
        criadoEm: new Date(Number(inserido[0].criado_em)).toISOString(),
        produtoId: input.produtoId,
        produtoNome: produto.nome,
        tipo: input.tipo,
        quantidade,
        motivo: input.motivo || null,
        observacao: input.observacao || null,
        saldoResultante: novoEstoque,
        estoqueAnterior: estoqueAtual,
      }
    })

    return resultado
  },

  /** Histórico paginado com filtros (produto, categoria, tipo, período). */
  async listar(params: {
    produtoId?: number
    categoriaId?: number
    tipo?: string
    de?: string
    ate?: string
    busca?: string
    ordem?: string
    dir?: string
  } & Paginacao) {
    const { page, limit, offset } = params

    const condicoes: string[] = []
    const valores: (string | number)[] = []

    if (params.produtoId) {
      condicoes.push('m.produto_id = ?')
      valores.push(params.produtoId)
    }
    if (params.categoriaId) {
      condicoes.push('p.categoria_id = ?')
      valores.push(params.categoriaId)
    }
    if (params.tipo === 'ENTRADA' || params.tipo === 'SAIDA') {
      condicoes.push('m.tipo = ?')
      valores.push(params.tipo)
    }
    if (params.de && /^\d{4}-\d{2}-\d{2}$/.test(params.de)) {
      condicoes.push('m.criado_em >= ?')
      valores.push(new Date(`${params.de}T00:00:00.000Z`).getTime())
    }
    if (params.ate && /^\d{4}-\d{2}-\d{2}$/.test(params.ate)) {
      condicoes.push('m.criado_em <= ?')
      valores.push(new Date(`${params.ate}T23:59:59.999Z`).getTime())
    }
    if (params.busca && params.busca.trim()) {
      condicoes.push('(p.nome LIKE ? OR p.sku LIKE ? OR m.motivo LIKE ? OR m.observacao LIKE ?)')
      const b = `%${params.busca.trim()}%`
      valores.push(b, b, b, b)
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''

    const ordem = COLUNAS_ORDENACAO[params.ordem ?? 'criado_em'] ?? COLUNAS_ORDENACAO.criado_em
    const dir = (params.dir ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const totalRows = await db.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*) AS total
       FROM movimentacoes m
       JOIN produtos p ON p.id = m.produto_id
       ${where}`,
      ...valores
    )
    const total = Number(totalRows[0]?.total ?? 0)

    const dados = await db.$queryRawUnsafe<any[]>(
      `SELECT m.id, m.produto_id AS produtoId, p.nome AS produtoNome, p.sku,
              c.nome AS categoriaNome, c.id AS categoriaId,
              m.tipo, m.quantidade, m.motivo, m.observacao,
              m.saldo_resultante AS saldoResultante,
              m.usuario_id AS usuarioId, u.nome AS usuarioNome,
              m.criado_em AS criadoEm
       FROM movimentacoes m
       JOIN produtos p ON p.id = m.produto_id
       JOIN categorias c ON c.id = p.categoria_id
       JOIN usuarios u ON u.id = m.usuario_id
       ${where}
       ORDER BY ${ordem} ${dir}
       LIMIT ? OFFSET ?`,
      ...valores, limit, offset
    )

    const resumo = await db.$queryRawUnsafe<any[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade END), 0) AS unidadesEntrada,
         COALESCE(SUM(CASE WHEN m.tipo = 'SAIDA' THEN m.quantidade END), 0) AS unidadesSaida
       FROM movimentacoes m
       JOIN produtos p ON p.id = m.produto_id
       ${where}`,
      ...valores
    )

    return {
      dados: dados.map(normalizar),
      meta: metaPaginacao({ page, limit, offset }, total),
      resumo: {
        unidadesEntrada: Number(resumo[0]?.unidadesEntrada ?? 0),
        unidadesSaida: Number(resumo[0]?.unidadesSaida ?? 0),
      },
    }
  },

  /** Movimentações recentes (dashboard e painel lateral). */
  async recentes(limite = 8) {
    const n = Math.min(50, Math.max(1, limite))
    const dados = await db.$queryRawUnsafe<any[]>(
      `SELECT m.id, m.produto_id AS produtoId, p.nome AS produtoNome, p.sku,
              m.tipo, m.quantidade, m.saldo_resultante AS saldoResultante,
              u.nome AS usuarioNome, m.criado_em AS criadoEm
       FROM movimentacoes m
       JOIN produtos p ON p.id = m.produto_id
       JOIN usuarios u ON u.id = m.usuario_id
       ORDER BY m.criado_em DESC, m.id DESC
       LIMIT ${n}`
    )
    return dados.map(normalizar)
  },
}

function normalizar(r: any) {
  return {
    ...r,
    id: Number(r.id),
    produtoId: Number(r.produtoId),
    quantidade: Number(r.quantidade),
    saldoResultante: Number(r.saldoResultante),
  }
}
