'use client'

/**
 * EstoquePro — Página raiz (SPA)
 * Autenticação + shell do aplicativo. Todas as views são renderizadas
 * nesta rota conforme a navegação do usuário.
 */
import { useCallback, useEffect, useState } from 'react'
import { AppShell, UsuarioSessao } from '@/components/app-shell'
import { LoginView } from '@/components/views/login-view'
import { api, limparToken, obterToken } from '@/lib/api'
import { Loader2 } from 'lucide-react'

export default function PaginaEstoquePro() {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null)
  const [verificando, setVerificando] = useState(true)

  const verificarSessao = useCallback(async () => {
    if (!obterToken()) {
      setVerificando(false)
      return
    }
    try {
      const u = await api.get<UsuarioSessao>('/api/auth/me')
      setUsuario(u)
    } catch {
      limparToken()
    } finally {
      setVerificando(false)
    }
  }, [])

  useEffect(() => {
    verificarSessao()
  }, [verificarSessao])

  if (verificando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm text-muted-foreground">Carregando EstoquePro…</p>
      </div>
    )
  }

  if (!usuario) {
    return <LoginView aoEntrar={setUsuario} />
  }

  return <AppShell usuario={usuario} aoSair={() => setUsuario(null)} />
}
