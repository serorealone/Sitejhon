/**
 * EstoquePro — Guarda de rotas (autenticação e permissões no SERVIDOR).
 * As permissões nunca dependem exclusivamente do front-end.
 */
import { db } from '@/lib/db'
import { ApiError } from './http'
import { verificarToken } from './security'

export interface UsuarioAuth {
  id: number
  nome: string
  email: string
  papel: 'ADMIN' | 'OPERADOR'
}

export function extrairToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return null
}

/**
 * Valida o token JWT e confere no banco se o usuário existe e está ativo
 * (usuários desativados perdem acesso imediatamente, mesmo com token válido).
 */
export async function requireAuth(req: Request, papeisPermitidos?: Array<'ADMIN' | 'OPERADOR'>): Promise<UsuarioAuth> {
  const token = extrairToken(req)
  if (!token) throw new ApiError(401, 'Autenticação necessária. Faça login para continuar.', 'NAO_AUTENTICADO')

  const payload = await verificarToken(token)
  if (!payload) throw new ApiError(401, 'Sessão inválida ou expirada. Faça login novamente.', 'TOKEN_INVALIDO')

  const usuario = await db.usuario.findUnique({
    where: { id: payload.sub },
    select: { id: true, nome: true, email: true, papel: true, ativo: true },
  })
  if (!usuario || !usuario.ativo) {
    throw new ApiError(401, 'Usuário inativo ou inexistente.', 'USUARIO_INATIVO')
  }

  if (papeisPermitidos && !papeisPermitidos.includes(usuario.papel as UsuarioAuth['papel'])) {
    throw new ApiError(403, 'Você não tem permissão para executar esta operação.', 'SEM_PERMISSAO')
  }

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel as UsuarioAuth['papel'],
  }
}
