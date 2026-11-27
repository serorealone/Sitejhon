/**
 * EstoquePro — Controlador de dashboard (papel ADMIN)
 */
import { handle, ok } from '../lib/http'
import { requireAuth } from '../lib/guard'
import { dashboardService } from '../services/dashboard.service'
import { movimentacoesService } from '../services/movimentacoes.service'

export const dashboardController = {
  async resumo(req: Request) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const [cards, recentes, top] = await Promise.all([
        dashboardService.resumo(),
        movimentacoesService.recentes(8),
        dashboardService.maisMovimentados(30, 5),
      ])
      return ok({ ...cards, movimentacoesRecentes: recentes, produtosMaisMovimentados: top })
    })
  },

  async series(req: Request) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const url = new URL(req.url)
      const dias = Number(url.searchParams.get('dias') ?? 30) || 30
      return ok(await dashboardService.series(dias))
    })
  },
}
