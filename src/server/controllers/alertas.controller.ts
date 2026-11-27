/**
 * EstoquePro — Controladores de alertas e relatórios
 * Alertas: ADMIN e OPERADOR. Relatórios: ADMIN.
 */
import { handle, ok } from '../lib/http'
import { requireAuth } from '../lib/guard'
import { alertasService } from '../services/alertas.service'
import { relatoriosService, relatorioParaCSV, FiltrosRelatorio } from '../services/relatorios.service'

export const alertasController = {
  async listar(req: Request) {
    return handle(async () => {
      await requireAuth(req)
      return ok(await alertasService.listar())
    })
  },
}

function filtrosDaUrl(url: URL) {
  const num = (chave: string) => {
    const v = url.searchParams.get(chave)
    const n = v ? Number(v) : NaN
    return Number.isInteger(n) && n > 0 ? n : undefined
  }
  const tipoMovimento = url.searchParams.get('tipoMovimento') ?? undefined
  const filtros: FiltrosRelatorio = {
    produtoId: num('produtoId'),
    categoriaId: num('categoriaId'),
    tipoMovimento: tipoMovimento === 'ENTRADA' || tipoMovimento === 'SAIDA' ? tipoMovimento : undefined,
    de: url.searchParams.get('de') ?? undefined,
    ate: url.searchParams.get('ate') ?? undefined,
  }
  return filtros
}

export const relatoriosController = {
  async gerar(req: Request) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const url = new URL(req.url)
      const tipo = url.searchParams.get('tipo') ?? ''
      const relatorio = await relatoriosService.gerar(tipo, filtrosDaUrl(url))
      return ok(relatorio)
    })
  },

  /** Exportação CSV — download com BOM para Excel. */
  async exportarCSV(req: Request) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const url = new URL(req.url)
      const tipo = url.searchParams.get('tipo') ?? ''
      const relatorio = await relatoriosService.gerar(tipo, filtrosDaUrl(url))
      const csv = relatorioParaCSV(relatorio)
      const nome = `relatorio-${relatorio.tipo}-${new Date().toISOString().slice(0, 10)}.csv`
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${nome}"`,
        },
      })
    })
  },
}
