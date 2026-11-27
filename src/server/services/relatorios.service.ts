/**
 * EstoquePro — Serviço de relatórios e análises
 * 8 relatórios construídos com consultas reais ao banco de dados.
 * Filtros: produto, categoria, tipo de movimentação e período.
 */
import { db } from '@/lib/db'
import { ApiError } from '../lib/http'

export type Coluna = { chave: string; rotulo: string; tipo?: 'texto' | 'numero' | 'moeda' | 'data' }

export interface Relatorio {
  tipo: string
  titulo: string
  subtitulo?: string
  colunas: Coluna[]
  linhas: Record<string, unknown>[]
  resumo: Record<string, string | number>
}

const TIPOS_VALIDOS = [
  'produtos-geral',
  'por-categoria',
  'estoque-baixo',
  'sem-estoque',
  'entradas',
  'saidas',
  'movimentacoes',
  'mais-movimentados',
] as const

export function validarTipo(tipo: string): (typeof TIPOS_VALIDOS)[number] {
  if (!(TIPOS_VALIDOS as readonly string[]).includes(tipo)) {
    throw new ApiError(400, `Relatório inválido: "${tipo}".`, 'RELATORIO_INVALIDO', { tiposValidos: TIPOS_VALIDOS })
  }
  return tipo as (typeof TIPOS_VALIDOS)[number]
}

export interface FiltrosRelatorio {
  produtoId?: number
  categoriaId?: number
  tipoMovimento?: 'ENTRADA' | 'SAIDA'
  de?: string
  ate?: string
}

const SQL_SITUACAO = `CASE
  WHEN p.quantidade = 0 THEN 'Sem estoque'
  WHEN p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo THEN 'Estoque baixo'
  ELSE 'Normal' END`

/** Condições de período (datas ISO convertidas para epoch ms — padrão do banco). */
function condsPeriodo(aliás: string, de?: string, ate?: string, valores?: (string | number)[]): string {
  const conds: string[] = []
  if (de && /^\d{4}-\d{2}-\d{2}$/.test(de)) {
    conds.push(`${aliás}.criado_em >= ?`)
    valores?.push(new Date(`${de}T00:00:00.000Z`).getTime())
  }
  if (ate && /^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    conds.push(`${aliás}.criado_em <= ?`)
    valores?.push(new Date(`${ate}T23:59:59.999Z`).getTime())
  }
  return conds.join(' AND ')
}

/** Converte epoch (ms) para ISO — usado nas linhas de relatório. */
function isoData(v: unknown): unknown {
  if (v === null || v === undefined) return v
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return new Date(n < 1e12 ? n * 1000 : n).toISOString()
}

export const relatoriosService = {
  async gerar(tipo: string, filtros: FiltrosRelatorio): Promise<Relatorio> {
    const t = validarTipo(tipo)
    switch (t) {
      case 'produtos-geral':
        return this.produtosGeral(filtros)
      case 'por-categoria':
        return this.porCategoria(filtros)
      case 'estoque-baixo':
        return this.situacao(filtros, 'baixo')
      case 'sem-estoque':
        return this.situacao(filtros, 'sem')
      case 'entradas':
        return this.movimentacoesTipo(filtros, 'ENTRADA')
      case 'saidas':
        return this.movimentacoesTipo(filtros, 'SAIDA')
      case 'movimentacoes':
        return this.movimentacoesPeriodo(filtros)
      case 'mais-movimentados':
        return this.maisMovimentados(filtros)
    }
  },

  async produtosGeral(filtros: FiltrosRelatorio): Promise<Relatorio> {
    const conds: string[] = ['p.ativo = 1']
    const valores: (string | number)[] = []
    if (filtros.categoriaId) {
      conds.push('p.categoria_id = ?')
      valores.push(filtros.categoriaId)
    }
    if (filtros.produtoId) {
      conds.push('p.id = ?')
      valores.push(filtros.produtoId)
    }
    const linhas = (await db.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.nome, p.sku, c.nome AS categoria, p.quantidade,
              p.estoque_minimo AS estoqueMinimo, ${SQL_SITUACAO} AS situacao,
              p.preco_custo AS precoCusto, p.preco_venda AS precoVenda,
              ROUND(p.quantidade * p.preco_custo, 2) AS valorEstoque
       FROM produtos p
       JOIN categorias c ON c.id = p.categoria_id
       WHERE ${conds.join(' AND ')}
       ORDER BY c.nome ASC, p.nome ASC`,
      ...valores
    ))
    const totalUnidades = linhas.reduce((s, l) => s + Number(l.quantidade), 0)
    const totalValor = linhas.reduce((s, l) => s + Number(l.valorEstoque), 0)
    return {
      tipo: 'produtos-geral',
      titulo: 'Relatório geral de produtos',
      subtitulo: 'Catálogo ativo com situação de estoque e valores',
      colunas: [
        { chave: 'id', rotulo: 'ID' },
        { chave: 'nome', rotulo: 'Produto' },
        { chave: 'sku', rotulo: 'SKU' },
        { chave: 'categoria', rotulo: 'Categoria' },
        { chave: 'quantidade', rotulo: 'Qtd. atual', tipo: 'numero' },
        { chave: 'estoqueMinimo', rotulo: 'Qtd. mínima', tipo: 'numero' },
        { chave: 'situacao', rotulo: 'Situação' },
        { chave: 'precoCusto', rotulo: 'Custo (R$)', tipo: 'moeda' },
        { chave: 'precoVenda', rotulo: 'Venda (R$)', tipo: 'moeda' },
        { chave: 'valorEstoque', rotulo: 'Valor em estoque (R$)', tipo: 'moeda' },
      ],
      linhas,
      resumo: {
        produtos: linhas.length,
        unidades: totalUnidades,
        valorTotalEstoque: Math.round(totalValor * 100) / 100,
      },
    }
  },

  async porCategoria(filtros: FiltrosRelatorio): Promise<Relatorio> {
    const conds: string[] = []
    const valores: (string | number)[] = []
    if (filtros.categoriaId) {
      conds.push('c.id = ?')
      valores.push(filtros.categoriaId)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const linhas = (await db.$queryRawUnsafe<any[]>(
      `SELECT c.id, c.nome AS categoria,
              COUNT(p.id) AS produtos,
              COALESCE(SUM(p.quantidade), 0) AS unidades,
              ROUND(COALESCE(SUM(p.quantidade * p.preco_custo), 0), 2) AS valorEstoque,
              SUM(CASE WHEN p.quantidade > 0 AND p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo THEN 1 ELSE 0 END) AS estoqueBaixo,
              SUM(CASE WHEN p.quantidade = 0 THEN 1 ELSE 0 END) AS semEstoque
       FROM categorias c
       LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo = 1
       ${where}
       GROUP BY c.id
       ORDER BY valorEstoque DESC, categoria ASC`,
      ...valores
    )).map((l) => ({
      ...l,
      produtos: Number(l.produtos),
      unidades: Number(l.unidades),
      valorEstoque: Number(l.valorEstoque),
      estoqueBaixo: Number(l.estoqueBaixo),
      semEstoque: Number(l.semEstoque),
    }))
    return {
      tipo: 'por-categoria',
      titulo: 'Relatório por categoria',
      subtitulo: 'Consolidado de produtos e valores por categoria',
      colunas: [
        { chave: 'id', rotulo: 'ID' },
        { chave: 'categoria', rotulo: 'Categoria' },
        { chave: 'produtos', rotulo: 'Produtos', tipo: 'numero' },
        { chave: 'unidades', rotulo: 'Unidades em estoque', tipo: 'numero' },
        { chave: 'estoqueBaixo', rotulo: 'Em estoque baixo', tipo: 'numero' },
        { chave: 'semEstoque', rotulo: 'Sem estoque', tipo: 'numero' },
        { chave: 'valorEstoque', rotulo: 'Valor em estoque (R$)', tipo: 'moeda' },
      ],
      linhas,
      resumo: {
        categorias: linhas.length,
        produtos: linhas.reduce((s, l) => s + Number(l.produtos), 0),
        unidades: linhas.reduce((s, l) => s + Number(l.unidades), 0),
      },
    }
  },

  async situacao(filtros: FiltrosRelatorio, qual: 'baixo' | 'sem'): Promise<Relatorio> {
    const cond =
      qual === 'baixo'
        ? 'p.quantidade > 0 AND p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo'
        : 'p.quantidade = 0'
    const conds: string[] = ['p.ativo = 1', cond]
    const valores: (string | number)[] = []
    if (filtros.categoriaId) {
      conds.push('p.categoria_id = ?')
      valores.push(filtros.categoriaId)
    }
    const linhas = (await db.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.nome, p.sku, c.nome AS categoria, p.quantidade,
              p.estoque_minimo AS estoqueMinimo, p.preco_custo AS precoCusto,
              p.preco_venda AS precoVenda, p.atualizado_em AS atualizadoEm
       FROM produtos p
       JOIN categorias c ON c.id = p.categoria_id
       WHERE ${conds.join(' AND ')}
       ORDER BY p.quantidade ASC, p.nome ASC`,
      ...valores
    )).map((l) => ({ ...l, atualizadoEm: isoData(l.atualizadoEm) }))
    return {
      tipo: qual === 'baixo' ? 'estoque-baixo' : 'sem-estoque',
      titulo: qual === 'baixo' ? 'Relatório de estoque baixo' : 'Relatório de produtos sem estoque',
      subtitulo:
        qual === 'baixo'
          ? 'Produtos ativos com quantidade igual ou inferior ao mínimo (não nula)'
          : 'Produtos ativos com quantidade zerada',
      colunas: [
        { chave: 'id', rotulo: 'ID' },
        { chave: 'nome', rotulo: 'Produto' },
        { chave: 'sku', rotulo: 'SKU' },
        { chave: 'categoria', rotulo: 'Categoria' },
        { chave: 'quantidade', rotulo: 'Qtd. atual', tipo: 'numero' },
        { chave: 'estoqueMinimo', rotulo: 'Qtd. mínima', tipo: 'numero' },
        { chave: 'precoCusto', rotulo: 'Custo (R$)', tipo: 'moeda' },
        { chave: 'precoVenda', rotulo: 'Venda (R$)', tipo: 'moeda' },
      ],
      linhas,
      resumo: { produtos: linhas.length, unidades: linhas.reduce((s, l) => s + Number(l.quantidade), 0) },
    }
  },

  async movimentacoesTipo(filtros: FiltrosRelatorio, tipo: 'ENTRADA' | 'SAIDA'): Promise<Relatorio> {
    const conds: string[] = ['m.tipo = ?']
    const valores: (string | number)[] = [tipo]
    if (filtros.produtoId) {
      conds.push('m.produto_id = ?')
      valores.push(filtros.produtoId)
    }
    if (filtros.categoriaId) {
      conds.push('p.categoria_id = ?')
      valores.push(filtros.categoriaId)
    }
    const periodo = condsPeriodo('m', filtros.de, filtros.ate, valores)
    if (periodo) conds.push(periodo)
    const linhas = (await db.$queryRawUnsafe<any[]>(
      `SELECT m.id, p.nome AS produto, p.sku, c.nome AS categoria,
              m.quantidade, m.saldo_resultante AS saldoResultante,
              m.motivo, m.observacao, u.nome AS usuario, m.criado_em AS dataHora
       FROM movimentacoes m
       JOIN produtos p ON p.id = m.produto_id
       JOIN categorias c ON c.id = p.categoria_id
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE ${conds.join(' AND ')}
       ORDER BY m.criado_em DESC
       LIMIT 2000`,
      ...valores
    )).map((l) => ({ ...l, dataHora: isoData(l.dataHora) }))
    const totalUnidades = linhas.reduce((s, l) => s + Number(l.quantidade), 0)
    return {
      tipo: tipo === 'ENTRADA' ? 'entradas' : 'saidas',
      titulo: tipo === 'ENTRADA' ? 'Relatório de entradas' : 'Relatório de saídas',
      subtitulo: 'Movimentações do tipo ' + (tipo === 'ENTRADA' ? 'entrada' : 'saída') + ' no período filtrado',
      colunas: [
        { chave: 'id', rotulo: 'ID' },
        { chave: 'dataHora', rotulo: 'Data/hora', tipo: 'data' },
        { chave: 'produto', rotulo: 'Produto' },
        { chave: 'sku', rotulo: 'SKU' },
        { chave: 'categoria', rotulo: 'Categoria' },
        { chave: 'quantidade', rotulo: 'Qtd.', tipo: 'numero' },
        { chave: 'saldoResultante', rotulo: 'Saldo resultante', tipo: 'numero' },
        ...(tipo === 'SAIDA' ? [{ chave: 'motivo', rotulo: 'Motivo' } as Coluna] : []),
        { chave: 'usuario', rotulo: 'Registrado por' },
      ],
      linhas,
      resumo: { movimentacoes: linhas.length, unidades: totalUnidades },
    }
  },

  async movimentacoesPeriodo(filtros: FiltrosRelatorio): Promise<Relatorio> {
    const conds: string[] = []
    const valores: (string | number)[] = []
    if (filtros.produtoId) {
      conds.push('m.produto_id = ?')
      valores.push(filtros.produtoId)
    }
    if (filtros.categoriaId) {
      conds.push('p.categoria_id = ?')
      valores.push(filtros.categoriaId)
    }
    if (filtros.tipoMovimento) {
      conds.push('m.tipo = ?')
      valores.push(filtros.tipoMovimento)
    }
    const periodo = condsPeriodo('m', filtros.de, filtros.ate, valores)
    if (periodo) conds.push(periodo)
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const linhas = (await db.$queryRawUnsafe<any[]>(
      `SELECT m.id, m.criado_em AS dataHora, m.tipo, p.nome AS produto, p.sku,
              c.nome AS categoria, m.quantidade, m.saldo_resultante AS saldoResultante,
              m.motivo, m.observacao, u.nome AS usuario
       FROM movimentacoes m
       JOIN produtos p ON p.id = m.produto_id
       JOIN categorias c ON c.id = p.categoria_id
       JOIN usuarios u ON u.id = m.usuario_id
       ${where}
       ORDER BY m.criado_em DESC
       LIMIT 2000`,
      ...valores
    )).map((l) => ({ ...l, dataHora: isoData(l.dataHora) }))
    const entradas = linhas.filter((l) => l.tipo === 'ENTRADA').reduce((s, l) => s + Number(l.quantidade), 0)
    const saidas = linhas.filter((l) => l.tipo === 'SAIDA').reduce((s, l) => s + Number(l.quantidade), 0)
    return {
      tipo: 'movimentacoes',
      titulo: 'Relatório de movimentações por período',
      subtitulo: 'Entradas e saídas com filtros combinados',
      colunas: [
        { chave: 'id', rotulo: 'ID' },
        { chave: 'dataHora', rotulo: 'Data/hora', tipo: 'data' },
        { chave: 'tipo', rotulo: 'Tipo' },
        { chave: 'produto', rotulo: 'Produto' },
        { chave: 'sku', rotulo: 'SKU' },
        { chave: 'categoria', rotulo: 'Categoria' },
        { chave: 'quantidade', rotulo: 'Qtd.', tipo: 'numero' },
        { chave: 'saldoResultante', rotulo: 'Saldo resultante', tipo: 'numero' },
        { chave: 'motivo', rotulo: 'Motivo' },
        { chave: 'usuario', rotulo: 'Registrado por' },
      ],
      linhas,
      resumo: {
        movimentacoes: linhas.length,
        unidadesEntrada: entradas,
        unidadesSaida: saidas,
        saldoLiquido: entradas - saidas,
      },
    }
  },

  async maisMovimentados(filtros: FiltrosRelatorio): Promise<Relatorio> {
    // Agregação em subconsulta: período aplicado apenas às movimentações,
    // mantendo na listagem produtos sem movimentação no período.
    const subValores: (string | number)[] = []
    const periodo = condsPeriodo('m', filtros.de, filtros.ate, subValores)
    const subWhere = periodo ? `WHERE ${periodo}` : ''

    const conds: string[] = []
    const valores: (string | number)[] = [...subValores]
    if (filtros.categoriaId) {
      conds.push('p.categoria_id = ?')
      valores.push(filtros.categoriaId)
    }
    if (filtros.produtoId) {
      conds.push('p.id = ?')
      valores.push(filtros.produtoId)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const linhas = (await db.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.nome AS produto, p.sku, c.nome AS categoria,
              COALESCE(ag.entradas, 0) AS entradas,
              COALESCE(ag.saidas, 0) AS saidas,
              COALESCE(ag.total, 0) AS totalMovimentado,
              COALESCE(ag.movimentacoes, 0) AS movimentacoes
       FROM produtos p
       JOIN categorias c ON c.id = p.categoria_id
       LEFT JOIN (
         SELECT m.produto_id,
                SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade END) AS entradas,
                SUM(CASE WHEN m.tipo = 'SAIDA' THEN m.quantidade END) AS saidas,
                SUM(m.quantidade) AS total,
                COUNT(m.id) AS movimentacoes
         FROM movimentacoes m
         ${subWhere}
         GROUP BY m.produto_id
       ) ag ON ag.produto_id = p.id
       ${where}
       ORDER BY totalMovimentado DESC, movimentacoes DESC, p.nome ASC
       LIMIT 50`,
      ...valores
    )).map((l) => ({
      ...l,
      entradas: Number(l.entradas),
      saidas: Number(l.saidas),
      totalMovimentado: Number(l.totalMovimentado),
      movimentacoes: Number(l.movimentacoes),
    }))
    return {
      tipo: 'mais-movimentados',
      titulo: 'Produtos com maior movimentação',
      subtitulo: 'Ranking por total de unidades movimentadas (entradas + saídas)',
      colunas: [
        { chave: 'id', rotulo: 'ID' },
        { chave: 'produto', rotulo: 'Produto' },
        { chave: 'sku', rotulo: 'SKU' },
        { chave: 'categoria', rotulo: 'Categoria' },
        { chave: 'entradas', rotulo: 'Entradas (un)', tipo: 'numero' },
        { chave: 'saidas', rotulo: 'Saídas (un)', tipo: 'numero' },
        { chave: 'totalMovimentado', rotulo: 'Total movimentado (un)', tipo: 'numero' },
        { chave: 'movimentacoes', rotulo: 'Nº de movimentações', tipo: 'numero' },
      ],
      linhas,
      resumo: { produtos: linhas.length },
    }
  },
}

/** Serializa relatório para CSV (BOM + separador ';' para Excel pt-BR). */
export function relatorioParaCSV(r: Relatorio): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const cabecalho = r.colunas.map((c) => esc(c.rotulo)).join(';')
  const linhas = r.linhas.map((l) => r.colunas.map((c) => esc(l[c.chave])).join(';')).join('\n')
  const resumo = Object.entries(r.resumo).map(([k, v]) => `${k}: ${v}`).join(' | ')
  return `\uFEFF${r.titulo}\n${r.subtitulo ?? ''}\n\n${cabecalho}\n${linhas}\n\nResumo;${esc(resumo)}\n`
}
