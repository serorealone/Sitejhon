/**
 * EstoquePro — Controlador de autenticação
 */
import { ApiError, created, handle, ok } from '../lib/http'
import { conferirSenha, assinarToken } from '../lib/security'
import { ipDaRequisicao, resetarRateLimit, verificarRateLimit } from '../lib/rate-limit'
import { loginSchema } from '../validators/schemas'
import { usuariosService } from '../services/usuarios.service'
import { requireAuth } from '../lib/guard'
import { db } from '@/lib/db'

export const authController = {
  async login(req: Request) {
    return handle(async () => {
      const chave = `login:${ipDaRequisicao(req)}`
      const limite = verificarRateLimit(chave)
      if (!limite.permitido) {
        throw new ApiError(
          429,
          `Muitas tentativas de login. Aguarde ${limite.segundosRestantes}s e tente novamente.`,
          'MUITAS_TENTATIVAS'
        )
      }

      const corpo = loginSchema.parse(await req.json())
      await usuariosService.garantirAdminPadrao()

      const usuario = await db.usuario.findUnique({ where: { email: corpo.email } })
      if (!usuario) throw new ApiError(401, 'E-mail ou senha incorretos.', 'CREDENCIAIS_INVALIDAS')

      const senhaOk = await conferirSenha(corpo.senha, usuario.senhaHash)
      if (!senhaOk) throw new ApiError(401, 'E-mail ou senha incorretos.', 'CREDENCIAIS_INVALIDAS')
      if (!usuario.ativo) throw new ApiError(403, 'Usuário desativado. Contate um administrador.', 'USUARIO_INATIVO')

      resetarRateLimit(chave)

      const token = await assinarToken({
        sub: usuario.id,
        papel: usuario.papel as 'ADMIN' | 'OPERADOR',
        nome: usuario.nome,
        email: usuario.email,
      })

      return ok({
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
        },
      })
    })
  },

  async me(req: Request) {
    return handle(async () => {
      const usuario = await requireAuth(req)
      return ok(usuario)
    })
  },

  /** Logout é tratado no cliente (descarte do token); endpoint mantido por contrato. */
  async logout(req: Request) {
    return handle(async () => {
      await requireAuth(req)
      return created({ mensagem: 'Sessão encerrada no cliente. Remova o token armazenado.' })
    })
  },
}
