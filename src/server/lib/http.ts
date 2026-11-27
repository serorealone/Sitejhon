/**
 * EstoquePro — Camada HTTP compartilhada da API
 * Erros padronizados, helpers de resposta e mapeamento de exceções.
 */
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(data, { status, headers })
}

export const ok = (data: unknown) => json(data, 200)
export const created = (data: unknown) => json(data, 201)

type PrismaLikeError = { code: string; meta?: { target?: string[]; modelName?: string } }

/** Converte qualquer exceção em resposta HTTP padronizada. */
export function mapError(e: unknown): Response {
  if (e instanceof ApiError) {
    return json(
      { erro: e.message, codigo: e.code ?? 'ERRO', detalhes: e.details },
      e.status
    )
  }
  if (e instanceof ZodError) {
    return json(
      {
        erro: 'Dados inválidos. Verifique os campos informados.',
        codigo: 'VALIDACAO',
        detalhes: e.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      },
      400
    )
  }
  const pe = e as PrismaLikeError
  if (pe && typeof pe.code === 'string' && pe.code.startsWith('P')) {
    if (pe.code === 'P2002') {
      return json(
        { erro: 'Registro duplicado: já existe um cadastro com esse valor único.', codigo: 'DUPLICADO', campos: pe.meta?.target },
        409
      )
    }
    if (pe.code === 'P2003') {
      return json(
        { erro: 'Operação bloqueada: o registro está vinculado a outros dados.', codigo: 'VINCULADO' },
        409
      )
    }
    if (pe.code === 'P2025') {
      return json({ erro: 'Registro não encontrado.', codigo: 'NAO_ENCONTRADO' }, 404)
    }
    console.error('[api] erro prisma:', pe.code, pe.meta)
  }
  console.error('[api] erro interno:', e)
  return json({ erro: 'Erro interno do servidor.', codigo: 'ERRO_INTERNO' }, 500)
}

/** Envolve o handler e aplica o mapeamento de erros. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (e) {
    return mapError(e)
  }
}

export interface Paginacao {
  page: number
  limit: number
  offset: number
}

/** Converte e valida parâmetro de rota numérico positivo. */
export function parseId(raw: string): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `Identificador inválido: "${raw}".`, 'ID_INVALIDO')
  }
  return id
}

export function parsePaginacao(url: URL, limiteMax = 100): Paginacao {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const limit = Math.min(limiteMax, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20))
  return { page, limit, offset: (page - 1) * limit }
}

export function metaPaginacao(p: Paginacao, total: number) {
  return {
    pagina: p.page,
    limite: p.limit,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / p.limit)),
  }
}
