/**
 * EstoquePro — Cliente HTTP do front-end
 * Injeta o token JWT, trata erros padronizados e sessão expirada.
 */
export interface ErroApi {
  erro: string
  codigo?: string
  detalhes?: unknown
  campos?: string[]
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
    public detalhes?: unknown
  ) {
    super(mensagem)
    this.name = 'ApiClientError'
  }
}

const CHAVE_TOKEN = 'estoquepro.token'

export function obterToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(CHAVE_TOKEN)
}

export function guardarToken(token: string) {
  window.localStorage.setItem(CHAVE_TOKEN, token)
}

export function limparToken() {
  window.localStorage.removeItem(CHAVE_TOKEN)
}

interface OpcoesRequest {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  corpo?: unknown
}

async function request<T>(caminho: string, opcoes: OpcoesRequest = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = obterToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (opcoes.corpo !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(caminho, {
    method: opcoes.metodo ?? 'GET',
    headers,
    body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    cache: 'no-store',
  })

  // Sessão inválida em requisições protegidas: limpa e volta ao login.
  // O próprio endpoint de login NÃO recarrega a página — assim, uma senha
  // incorreta exibe a mensagem de erro na tela em vez de recarregar em silêncio.
  if (res.status === 401 && typeof window !== 'undefined' && !caminho.startsWith('/api/auth/login')) {
    limparToken()
    window.location.reload()
    throw new ApiClientError(401, 'NAO_AUTENTICADO', 'Sua sessão foi encerrada. Faça login novamente.')
  }

  const texto = await res.text()
  let dados: unknown = undefined
  if (texto) {
    try {
      dados = JSON.parse(texto)
    } catch {
      dados = texto
    }
  }

  if (!res.ok) {
    const e = (dados ?? {}) as ErroApi
    throw new ApiClientError(res.status, e.codigo ?? 'ERRO', e.erro ?? `Erro ${res.status}`, e.detalhes)
  }

  return dados as T
}

export const api = {
  get: <T>(caminho: string) => request<T>(caminho),
  post: <T>(caminho: string, corpo?: unknown) => request<T>(caminho, { metodo: 'POST', corpo }),
  patch: <T>(caminho: string, corpo?: unknown) => request<T>(caminho, { metodo: 'PATCH', corpo }),
  del: <T>(caminho: string) => request<T>(caminho, { metodo: 'DELETE' }),
}

/** Download autenticado de arquivo (CSV) via blob. */
export async function baixarArquivo(caminho: string, nomeArquivo: string) {
  const headers: Record<string, string> = {}
  const token = obterToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(caminho, { headers })
  if (!res.ok) throw new ApiClientError(res.status, 'ERRO', 'Falha ao exportar arquivo.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
