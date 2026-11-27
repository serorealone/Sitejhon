/**
 * EstoquePro — Limitador de tentativas de login (proteção brute-force).
 * Controle em memória: 8 tentativas por chave a cada 10 minutos.
 */
type Registro = { count: number; expiraEm: number }

const janelaMs = 10 * 60 * 1000
const maxTentativas = 8
const registros = new Map<string, Registro>()

export function verificarRateLimit(chave: string): { permitido: boolean; segundosRestantes: number } {
  const agora = Date.now()
  const reg = registros.get(chave)

  if (!reg || reg.expiraEm <= agora) {
    registros.set(chave, { count: 1, expiraEm: agora + janelaMs })
    return { permitido: true, segundosRestantes: 0 }
  }

  reg.count += 1
  if (reg.count > maxTentativas) {
    const segundosRestantes = Math.ceil((reg.expiraEm - agora) / 1000)
    return { permitido: false, segundosRestantes }
  }
  return { permitido: true, segundosRestantes: 0 }
}

export function resetarRateLimit(chave: string) {
  registros.delete(chave)
}

export function ipDaRequisicao(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  )
}
