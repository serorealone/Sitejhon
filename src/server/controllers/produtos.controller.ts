/**
 * EstoquePro — Controlador de produtos
 * Papéis: leitura para todos; escrita apenas ADMIN.
 */
import { ApiError, created, handle, ok, parseId, parsePaginacao } from '../lib/http'
import { requireAuth } from '../lib/guard'
import { produtoSchema, produtoUpdateSchema } from '../validators/schemas'
import { produtosService } from '../services/produtos.service'
import { movimentacoesService } from '../services/movimentacoes.service'

type Ctx = { params: Promise<{ id: string }> }

function numeroQuery(url: URL, chave: string): number | undefined {
  const v = url.searchParams.get(chave)
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export const produtosController = {
  async listar(req: Request) {
    return handle(async () => {
      await requireAuth(req)
      const url = new URL(req.url)
      const pag = parsePaginacao(url)
      const r = await produtosService.listar({
        busca: url.searchParams.get('busca') ?? undefined,
        sku: url.searchParams.get('sku') ?? undefined,
        categoriaId: numeroQuery(url, 'categoriaId'),
        status: url.searchParams.get('status') ?? undefined,
        ativo: url.searchParams.get('ativo') ?? undefined,
        ordem: url.searchParams.get('ordem') ?? undefined,
        dir: url.searchParams.get('dir') ?? undefined,
        ...pag,
      })
      return ok(r)
    })
  },

  async buscarPorId(req: Request, ctx: Ctx) {
    return handle(async () => {
      await requireAuth(req)
      const { id } = await ctx.params
      const produto = await produtosService.buscarPorId(parseId(id))
      const historico = await movimentacoesService.listar({
        produtoId: produto.id,
        page: 1,
        limit: 10,
        offset: 0,
      })
      return ok({ ...produto, historicoRecente: historico.dados })
    })
  },

  async criar(req: Request) {
    return handle(async () => {
      const auth = await requireAuth(req, ['ADMIN'])
      const corpo = produtoSchema.parse(await req.json())
      return created(await produtosService.criar(corpo, auth.id))
    })
  },

  async atualizar(req: Request, ctx: Ctx) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const { id } = await ctx.params
      const corpo = produtoUpdateSchema.parse(await req.json())
      return ok(await produtosService.atualizar(parseId(id), corpo))
    })
  },

  async excluir(req: Request, ctx: Ctx) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const { id } = await ctx.params
      await produtosService.excluir(parseId(id))
      return ok({ mensagem: 'Produto excluído com sucesso.' })
    })
  },

  async arquivar(req: Request, ctx: Ctx) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const { id } = await ctx.params
      const corpo = (await req.json()) as { arquivar?: boolean }
      if (typeof corpo.arquivar !== 'boolean') {
        throw new ApiError(400, 'Informe "arquivar": true ou false.', 'VALIDACAO')
      }
      return ok(await produtosService.arquivar(parseId(id), corpo.arquivar))
    })
  },
}
