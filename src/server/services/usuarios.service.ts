/**
 * EstoquePro — Serviço de usuários (administração, papel ADMIN)
 * Senhas nunca retornam em respostas da API.
 */
import { db } from '@/lib/db'
import { ApiError } from '../lib/http'
import { hashSenha } from '../lib/security'
import { UsuarioInput, UsuarioUpdateInput } from '../validators/schemas'

const SELECAO_PUBLICA = { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true } as const

export const usuariosService = {
  async listar() {
    const usuarios = await db.usuario.findMany({
      select: SELECAO_PUBLICA,
      orderBy: { nome: 'asc' },
    })
    return usuarios
  },

  async criar(input: UsuarioInput) {
    const existente = await db.usuario.findFirst({
      where: { email: { equals: input.email } },
    })
    if (existente) throw new ApiError(409, `Já existe um usuário com o e-mail "${input.email}".`, 'DUPLICADO')

    const senhaHash = await hashSenha(input.senha)
    const usuario = await db.usuario.create({
      data: {
        nome: input.nome,
        email: input.email,
        senhaHash,
        papel: input.papel,
      },
      select: SELECAO_PUBLICA,
    })
    return usuario
  },

  async atualizar(id: number, input: UsuarioUpdateInput, usuarioLogadoId: number) {
    const atual = await db.usuario.findUnique({ where: { id } })
    if (!atual) throw new ApiError(404, 'Usuário não encontrado.', 'NAO_ENCONTRADO')

    // Bloqueia auto-rebaixamento/auto-desativação (evita administrador sem acesso)
    if (id === usuarioLogadoId) {
      if (input.ativo === false) throw new ApiError(400, 'Você não pode desativar seu próprio usuário.', 'OPERACAO_INVALIDA')
      if (input.papel && input.papel !== 'ADMIN') {
        throw new ApiError(400, 'Você não pode rebaixar seu próprio papel de administrador.', 'OPERACAO_INVALIDA')
      }
    }

    // Garante que sempre exista pelo menos um administrador ativo
    if ((input.ativo === false || input.papel === 'OPERADOR') && atual.papel === 'ADMIN' && atual.ativo) {
      const adminsAtivos = await db.usuario.count({ where: { papel: 'ADMIN', ativo: true, id: { not: id } } })
      if (adminsAtivos === 0) {
        throw new ApiError(400, 'O sistema deve manter pelo menos um administrador ativo.', 'ULTIMO_ADMIN')
      }
    }

    if (input.senha) {
      const senhaHash = await hashSenha(input.senha)
      await db.usuario.update({ where: { id }, data: { senhaHash } })
    }

    const usuario = await db.usuario.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.papel !== undefined ? { papel: input.papel } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
      },
      select: SELECAO_PUBLICA,
    })
    return usuario
  },

  /**
   * Exclusão: usuários com movimentações registradas não são apagados
   * (preservação da auditoria) — recomenda-se desativar.
   */
  async excluir(id: number, usuarioLogadoId: number) {
    if (id === usuarioLogadoId) {
      throw new ApiError(400, 'Você não pode excluir seu próprio usuário.', 'OPERACAO_INVALIDA')
    }
    const atual = await db.usuario.findUnique({ where: { id } })
    if (!atual) throw new ApiError(404, 'Usuário não encontrado.', 'NAO_ENCONTRADO')

    if (atual.papel === 'ADMIN' && atual.ativo) {
      const adminsAtivos = await db.usuario.count({ where: { papel: 'ADMIN', ativo: true, id: { not: id } } })
      if (adminsAtivos === 0) {
        throw new ApiError(400, 'O sistema deve manter pelo menos um administrador ativo.', 'ULTIMO_ADMIN')
      }
    }

    const movimentacoes = await db.movimentacao.count({ where: { usuarioId: id } })
    if (movimentacoes > 0) {
      throw new ApiError(
        409,
        `Usuário possui ${movimentacoes} movimentação(ões) registradas. Desative-o em vez de excluir para preservar a auditoria.`,
        'USUARIO_COM_HISTORICO',
        { movimentacoes }
      )
    }
    await db.usuario.delete({ where: { id } })
  },

  /** Garante a existência de um administrador padrão (primeira execução). */
  async garantirAdminPadrao() {
    const total = await db.usuario.count()
    if (total > 0) return
    const senhaHash = await hashSenha('Admin@123')
    await db.usuario.create({
      data: { nome: 'Administrador', email: 'admin@estoquepro.com', senhaHash, papel: 'ADMIN' },
    })
    console.log('[bootstrap] administrador padrão criado: admin@estoquepro.com')
  },
}
