/**
 * EstoquePro — Serviço do dashboard
 * Todos os indicadores são calculados por consultas reais ao banco.
 */
import { db } from '@/lib/db'

export const dashboardService = {
  async resumo() {
    const cards = await db.$queryRawUnsafe<any[]>(`
      SELECT
        (SELECT COUNT(*) FROM produtos WHERE ativo = 1) AS produtosAtivos,
        (SELECT COUNT(*) FROM categorias) AS categorias,
        (SELECT COALESCE(SUM(quantidade), 0) FROM produtos WHERE ativo = 1) AS unidadesEstoque,
        (SELECT COALESCE(SUM(quantidade * preco_custo), 0) FROM produtos WHERE ativo = 1) AS valorEstoque,
        (SELECT COUNT(*) FROM produtos WHERE ativo = 1 AND quantidade = 0) AS semEstoque,
        (SELECT COUNT(*) FROM produtos
          WHERE ativo = 1 AND quantidade > 0 AND estoque_minimo > 0 AND quantidade <= estoque_minimo) AS estoqueBaixo,
        (SELECT COUNT(*) FROM movimentacoes WHERE tipo = 'ENTRADA') AS totalEntradas,
        (SELECT COUNT(*) FROM movimentacoes WHERE tipo = 'SAIDA') AS totalSaidas,
        (SELECT COUNT(*) FROM movimentacoes
          WHERE tipo = 'ENTRADA' AND criado_em >= strftime('%s','now','-1 day') * 1000) AS entradas24h,
        (SELECT COUNT(*) FROM movimentacoes
          WHERE tipo = 'SAIDA' AND criado_em >= strftime('%s','now','-1 day') * 1000) AS saidas24h
    `)
    const c = cards[0]
    const converter = (v: unknown) => Number(v ?? 0)
    return {
      produtosAtivos: converter(c.produtosAtivos),
      categorias: converter(c.categorias),
      unidadesEstoque: converter(c.unidadesEstoque),
      valorEstoque: Math.round(converter(c.valorEstoque) * 100) / 100,
      semEstoque: converter(c.semEstoque),
      estoqueBaixo: converter(c.estoqueBaixo),
      totalEntradas: converter(c.totalEntradas),
      totalSaidas: converter(c.totalSaidas),
      entradas24h: converter(c.entradas24h),
      saidas24h: converter(c.saidas24h),
    }
  },

  /** Série diária de entradas/saídas + evolução do estoque no período. */
  async series(dias: number) {
    const periodo = Math.min(180, Math.max(7, dias))

    const fluxo = await db.$queryRawUnsafe<any[]>(
      `SELECT date(criado_em/1000, 'unixepoch') AS dia,
              COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN quantidade END), 0) AS entradas,
              COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade END), 0) AS saidas
       FROM movimentacoes
       WHERE criado_em >= strftime('%s','now', ?) * 1000
       GROUP BY date(criado_em/1000, 'unixepoch')
       ORDER BY dia ASC`,
      `-${periodo} days`
    )

    const atualRows = await db.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(quantidade), 0) AS total FROM produtos WHERE ativo = 1`
    )
    const estoqueAtual = Number(atualRows[0]?.total ?? 0)

    // Evolução: recalcula para trás a partir do estoque atual
    // saldoFinal(d) = estoqueAtual - Σ net(t) para todo t > d
    const mapaFluxo = new Map<string, { entradas: number; saidas: number }>()
    for (const f of fluxo) {
      mapaFluxo.set(String(f.dia), { entradas: Number(f.entradas), saidas: Number(f.saidas) })
    }

    const serie: { dia: string; entradas: number; saidas: number; saldoEstoque: number }[] = []
    let acumuladoFuturo = 0
    const hoje = new Date()
    const diasLista: string[] = []
    for (let i = periodo - 1; i >= 0; i--) {
      const d = new Date(hoje.getTime() - i * 86400000)
      diasLista.push(d.toISOString().slice(0, 10))
    }
    for (let i = diasLista.length - 1; i >= 0; i--) {
      const dia = diasLista[i]
      const f = mapaFluxo.get(dia) ?? { entradas: 0, saidas: 0 }
      acumuladoFuturo += f.entradas - f.saidas
      const saldo = estoqueAtual - acumuladoFuturo
      serie.unshift({ dia, entradas: f.entradas, saidas: f.saidas, saldoEstoque: Math.max(0, saldo) })
    }

    const porCategoria = await db.$queryRawUnsafe<any[]>(`
      SELECT c.nome AS categoria, COUNT(p.id) AS produtos,
             COALESCE(SUM(p.quantidade), 0) AS unidades
      FROM categorias c
      LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo = 1
      GROUP BY c.id
      ORDER BY unidades DESC, categoria ASC`)

    return {
      periodo,
      serie: serie.map((s) => ({
        dia: s.dia,
        entradas: s.entradas,
        saidas: s.saidas,
        saldoEstoque: s.saldoEstoque,
      })),
      porCategoria: porCategoria.map((x) => ({
        categoria: x.categoria,
        produtos: Number(x.produtos),
        unidades: Number(x.unidades),
      })),
    }
  },

  /** Produtos com maior movimentação (entradas + saídas) no período. */
  async maisMovimentados(dias: number, limite = 5) {
    const periodo = Math.min(180, Math.max(7, dias))
    const n = Math.min(20, Math.max(1, limite))
    const dados = await db.$queryRawUnsafe<any[]>(
      `SELECT p.id, p.nome AS produto, p.sku, c.nome AS categoria,
              COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade END), 0) AS entradas,
              COALESCE(SUM(CASE WHEN m.tipo = 'SAIDA' THEN m.quantidade END), 0) AS saidas,
              COALESCE(SUM(m.quantidade), 0) AS total
       FROM movimentacoes m
       JOIN produtos p ON p.id = m.produto_id
       JOIN categorias c ON c.id = p.categoria_id
       WHERE m.criado_em >= strftime('%s','now', ?) * 1000
       GROUP BY p.id
       ORDER BY total DESC
       LIMIT ${n}`,
      `-${periodo} days`
    )
    return dados.map((x) => ({
      id: Number(x.id),
      produto: x.produto,
      sku: x.sku,
      categoria: x.categoria,
      entradas: Number(x.entradas),
      saidas: Number(x.saidas),
      total: Number(x.total),
    }))
  },
}
