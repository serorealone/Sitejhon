/**
 * EstoquePro — Controlador de categorias
 * Papéis: leitura para todos; escrita apenas ADMIN.
 */
import { created, handle, ok, parseId, parsePaginacao } from '../lib/http'
import { requireAuth } from '../lib/guard'
import { categoriaSchema } from '../validators/schemas'
import { categoriasService } from '../services/categorias.service'

type Ctx = { params: Promise<{ id: string }> }

export const categoriasController = {
  async listar(req: Request) {
    return handle(async () => {
      await requireAuth(req)
      const url = new URL(req.url)
      const pag = parsePaginacao(url)
      const r = await categoriasService.listar({
        busca: url.searchParams.get('busca') ?? undefined,
        ordem: url.searchParams.get('ordem') ?? undefined,
        dir: url.searchParams.get('dir') ?? undefined,
        ...pag,
      })
      return ok(r)
    })
  },

  async resumo(req: Request) {
    return handle(async () => {
      await requireAuth(req)
      return ok(await categoriasService.listarResumo())
    })
  },

  async buscarPorId(req: Request, ctx: Ctx) {
    return handle(async () => {
      await requireAuth(req)
      const { id } = await ctx.params
      return ok(await categoriasService.buscarPorId(parseId(id)))
    })
  },

  async criar(req: Request) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const corpo = categoriaSchema.parse(await req.json())
      return created(await categoriasService.criar(corpo))
    })
  },

  async atualizar(req: Request, ctx: Ctx) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const { id } = await ctx.params
      const corpo = categoriaSchema.partial().parse(await req.json())
      return ok(await categoriasService.atualizar(parseId(id), corpo))
    })
  },

  async excluir(req: Request, ctx: Ctx) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const { id } = await ctx.params
      await categoriasService.excluir(parseId(id))
      return ok({ mensagem: 'Categoria excluída com sucesso.' })
    })
  },
}
