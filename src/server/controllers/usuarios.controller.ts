/**
 * EstoquePro — Controlador de usuários (papel ADMIN)
 */
import { ApiError, created, handle, ok, parseId } from '../lib/http'
import { requireAuth } from '../lib/guard'
import { usuarioSchema, usuarioUpdateSchema } from '../validators/schemas'
import { usuariosService } from '../services/usuarios.service'

type Ctx = { params: Promise<{ id: string }> }

export const usuariosController = {
  async listar(req: Request) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      return ok(await usuariosService.listar())
    })
  },

  async criar(req: Request) {
    return handle(async () => {
      await requireAuth(req, ['ADMIN'])
      const corpo = usuarioSchema.parse(await req.json())
      return created(await usuariosService.criar(corpo))
    })
  },

  async atualizar(req: Request, ctx: Ctx) {
    return handle(async () => {
      const auth = await requireAuth(req, ['ADMIN'])
      const { id } = await ctx.params
      const corpo = usuarioUpdateSchema.parse(await req.json())
      if (Object.keys(corpo).length === 0) {
        throw new ApiError(400, 'Nenhum campo para atualizar.', 'VALIDACAO')
      }
      return ok(await usuariosService.atualizar(parseId(id), corpo, auth.id))
    })
  },

  async excluir(req: Request, ctx: Ctx) {
    return handle(async () => {
      const auth = await requireAuth(req, ['ADMIN'])
      const { id } = await ctx.params
      await usuariosService.excluir(parseId(id), auth.id)
      return ok({ mensagem: 'Usuário excluído com sucesso.' })
    })
  },
}
