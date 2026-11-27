/**
 * EstoquePro — Utilitários de segurança
 * Hash de senhas (bcrypt) e tokens JWT (assimétricos via jose HMAC).
 * Nenhuma senha é armazenada ou registrada em texto puro.
 *
 * CORREÇÃO DE SESSÃO: o segredo do JWT é resolvido UMA vez por processo
 * e, quando não há JWT_SECRET no ambiente, usa um segredo de desenvolvimento
 * PERSISTIDO em arquivo — antes, era gerado aleatoriamente A CADA chamada,
 * o que invalidava todo token imediatamente após o login ("Sessão expirada").
 */
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { SignJWT, jwtVerify } from 'jose'
import { ApiError } from './http'

const BCRYPT_ROUNDS = 10

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, BCRYPT_ROUNDS)
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

let _segredoCache: Uint8Array | null = null

/**
 * Segredo de desenvolvimento estável: salvo em arquivo na raiz do projeto
 * e reutilizado em todas as chamadas e reinícios do servidor, para que os
 * tokens não sejam invalidados ao reiniciar o processo.
 */
function lerSegredoPersistido(): string {
  const caminho = path.join(process.cwd(), '.jwt-segredo-dev')
  try {
    if (existsSync(caminho)) {
      const conteudo = readFileSync(caminho, 'utf8').trim()
      if (conteudo.length >= 32) return conteudo
    }
    const novo = randomBytes(48).toString('hex')
    writeFileSync(caminho, novo, { encoding: 'utf8', mode: 0o600 })
    return novo
  } catch {
    // Sem acesso a disco (caso raro): segredo em memória desta execução
    return randomBytes(48).toString('hex')
  }
}

function segredoJwt(): Uint8Array {
  // Cache por processo: assinar e verificar usam SEMPRE o mesmo segredo
  if (_segredoCache) return _segredoCache

  const segredo = process.env.JWT_SECRET
  if (!segredo || segredo.length < 32) {
    // Em produção o segredo DEVE vir de variável de ambiente (ver README).
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(500, 'JWT_SECRET não configurado no ambiente.', 'CONFIG_FALTANDO')
    }
    console.warn('[seguranca] JWT_SECRET ausente — usando segredo de desenvolvimento ESTÁVEL (.jwt-segredo-dev).')
    _segredoCache = new TextEncoder().encode(lerSegredoPersistido())
    return _segredoCache
  }
  _segredoCache = new TextEncoder().encode(segredo)
  return _segredoCache
}

export interface PayloadJwt {
  sub: number
  papel: 'ADMIN' | 'OPERADOR'
  nome: string
  email: string
}

export async function assinarToken(payload: PayloadJwt, expiracao = '24h'): Promise<string> {
  return new SignJWT({ ...payload, sub: String(payload.sub) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('estoquepro')
    .setExpirationTime(expiracao || process.env.JWT_EXPIRES_IN || '24h')
    .sign(segredoJwt())
}

export async function verificarToken(token: string): Promise<PayloadJwt | null> {
  try {
    const { payload } = await jwtVerify(token, segredoJwt(), { issuer: 'estoquepro' })
    if (typeof payload.sub === 'undefined') return null
    return {
      sub: Number(payload.sub),
      papel: payload.papel as PayloadJwt['papel'],
      nome: payload.nome as string,
      email: payload.email as string,
    }
  } catch {
    return null
  }
}
