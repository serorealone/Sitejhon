/**
 * EstoquePro — Tela de autenticação
 */
import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Logo } from '@/components/logo'
import { api, guardarToken, ApiClientError } from '@/lib/api'
import { toast } from 'sonner'
import { BarChart3, Boxes, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { UsuarioSessao } from '@/components/app-shell'

export function LoginView({ aoEntrar }: { aoEntrar: (u: UsuarioSessao) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.')
      return
    }
    setEnviando(true)
    try {
      const r = await api.post<{ token: string; usuario: UsuarioSessao }>('/api/auth/login', {
        email: email.trim(),
        senha,
      })
      guardarToken(r.token)
      toast.success(`Bem-vindo(a), ${r.usuario.nome.split(' ')[0]}!`)
      aoEntrar(r.usuario)
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        // Erro de regra/negócio da API (ex.: credenciais incorretas)
        setErro(err.message)
      } else {
        // Falha de rede/conexão: mensagem clara em vez do texto do navegador
        setErro('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  const usarCredencial = (papel: 'admin' | 'operador') => {
    if (papel === 'admin') {
      setEmail('admin@estoquepro.com')
      setSenha('Admin@123')
    } else {
      setEmail('operador@estoquepro.com')
      setSenha('Operador@123')
    }
    setErro(null)
  }

  return (
    <div className="flex min-h-screen">
      {/* painel da marca */}
      <div className="hidden lg:flex gradiente-marca flex-col justify-between p-10 w-[45%] relative overflow-hidden">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -right-10 bottom-24 h-56 w-56 rounded-full bg-white/10" aria-hidden />
        <div className="relative">
          <Logo claro tamanhoIcone={26} />
        </div>
        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-white leading-snug">
              Controle total do seu estoque,
              <br />
              com simplicidade profissional.
            </h1>
            <p className="mt-3 text-emerald-50/90 text-sm max-w-md leading-relaxed">
              Produtos, categorias, entradas e saídas, alertas automáticos e relatórios —
              tudo com banco de dados relacional e API segura.
            </p>
          </div>
          <ul className="space-y-4 text-sm text-white/95">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Boxes className="h-5 w-5" />
              </span>
              Movimentações atômicas com histórico permanente
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <TriangleAlert className="h-5 w-5" />
              </span>
              Alertas automáticos de estoque baixo e zerado
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <BarChart3 className="h-5 w-5" />
              </span>
              Dashboard e relatórios com dados reais
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <ShieldCheck className="h-5 w-5" />
              </span>
              Autenticação com senhas protegidas e permissões
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-emerald-50/70">© 2026 EstoquePro · Sistema de gerenciamento de estoque</p>
      </div>

      {/* formulário */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <Logo tamanhoIcone={26} />
          </div>
          <Card className="shadow-md border-slate-200 py-0">
            <CardContent className="p-7 sm:p-8">
              <h2 className="text-xl font-bold text-slate-900">Acessar o sistema</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Entre com suas credenciais para continuar.
              </p>

              <form onSubmit={enviar} className="space-y-4" noValidate>
                {erro && (
                  <Alert variant="destructive">
                    <AlertDescription>{erro}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@empresa.com"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={enviando}>
                  {enviando ? 'Entrando…' : 'Entrar'}
                </Button>
              </form>

              <div className="mt-6 rounded-lg border bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Credenciais de demonstração</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => usarCredencial('admin')}
                  >
                    Administrador
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => usarCredencial('operador')}
                  >
                    Operador
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  admin@estoquepro.com / Admin@123 · operador@estoquepro.com / Operador@123
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
