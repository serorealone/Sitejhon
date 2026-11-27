/**
 * EstoquePro — Controlador de movimentações
 * Papéis: registro e leitura permitidos para ADMIN e OPERADOR.
 */
import { created, handle, ok, parsePaginacao } from '../lib/http'
import { requireAuth } from '../lib/guard'
import { movimentacaoSchema } from '../validators/schemas'
import { movimentacoesService } from '../services/movimentacoes.service'

function numeroQuery(url: URL, chave: string): number | undefined {
  const v = url.searchParams.get(chave)
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export const movimentacoesController = {
  /** POST /api/movimentacoes — registra entrada ou saída (atômico). */
  async registrar(req: Request) {
    return handle(async () => {
      const auth = await requireAuth(req) // ADMIN e OPERADOR podem registrar
      const corpo = movimentacaoSchema.parse(await req.json())
      const resultado = await movimentacoesService.registrar(corpo, auth.id)
      return created(resultado)
    })
  },

  /** GET /api/movimentacoes — histórico com filtros e paginação. */
  async listar(req: Request) {
    return handle(async () => {
      await requireAuth(req)
      const url = new URL(req.url)
      const pag = parsePaginacao(url)
      const tipo = url.searchParams.get('tipo') ?? undefined
      const r = await movimentacoesService.listar({
        produtoId: numeroQuery(url, 'produtoId'),
        categoriaId: numeroQuery(url, 'categoriaId'),
        tipo: tipo === 'ENTRADA' || tipo === 'SAIDA' ? tipo : undefined,
        de: url.searchParams.get('de') ?? undefined,
        ate: url.searchParams.get('ate') ?? undefined,
        busca: url.searchParams.get('busca') ?? undefined,
        ordem: url.searchParams.get('ordem') ?? undefined,
        dir: url.searchParams.get('dir') ?? undefined,
        ...pag,
      })
      return ok(r)
    })
  },

  /** GET /api/movimentacoes/recentes — últimas movimentações. */
  async recentes(req: Request) {
    return handle(async () => {
      await requireAuth(req)
      const url = new URL(req.url)
      const limite = Number(url.searchParams.get('limite') ?? 8) || 8
      return ok(await movimentacoesService.recentes(limite))
    })
  },
}
