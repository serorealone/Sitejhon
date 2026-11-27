/**
 * EstoquePro — Estrutura do aplicativo (SPA)
 * Menu lateral escuro com marca, barra superior com usuário e
 * navegação por estado (hash) entre as views.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Package,
  Tags,
  ArrowLeftRight,
  History,
  TriangleAlert,
  FileText,
  Users,
  LogOut,
  Menu,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'
import { api, limparToken } from '@/lib/api'
import { toast } from 'sonner'
import { DashboardView } from '@/components/views/dashboard-view'
import { ProdutosView } from '@/components/views/produtos-view'
import { CategoriasView } from '@/components/views/categorias-view'
import { MovimentarView } from '@/components/views/movimentar-view'
import { HistoricoView } from '@/components/views/historico-view'
import { AlertasView } from '@/components/views/alertas-view'
import { RelatoriosView } from '@/components/views/relatorios-view'
import { UsuariosView } from '@/components/views/usuarios-view'

export interface UsuarioSessao {
  id: number
  nome: string
  email: string
  papel: 'ADMIN' | 'OPERADOR'
}

export type IdView =
  | 'dashboard'
  | 'produtos'
  | 'categorias'
  | 'movimentar'
  | 'historico'
  | 'alertas'
  | 'relatorios'
  | 'usuarios'

interface ItemMenu {
  id: IdView
  rotulo: string
  icone: typeof Package
  papeis: Array<'ADMIN' | 'OPERADOR'>
  titulo: string
  descricao: string
}

const ITENS_MENU: ItemMenu[] = [
  {
    id: 'dashboard',
    rotulo: 'Dashboard',
    icone: LayoutDashboard,
    papeis: ['ADMIN'],
    titulo: 'Dashboard',
    descricao: 'Visão geral do estoque em tempo real',
  },
  {
    id: 'produtos',
    rotulo: 'Produtos',
    icone: Package,
    papeis: ['ADMIN', 'OPERADOR'],
    titulo: 'Produtos',
    descricao: 'Catálogo completo com pesquisa, filtros e ordenação',
  },
  {
    id: 'categorias',
    rotulo: 'Categorias',
    icone: Tags,
    papeis: ['ADMIN', 'OPERADOR'],
    titulo: 'Categorias',
    descricao: 'Organização dos produtos por categoria',
  },
  {
    id: 'movimentar',
    rotulo: 'Movimentar',
    icone: ArrowLeftRight,
    papeis: ['ADMIN', 'OPERADOR'],
    titulo: 'Entradas e saídas',
    descricao: 'Registre movimentações de estoque com atualização automática',
  },
  {
    id: 'historico',
    rotulo: 'Histórico',
    icone: History,
    papeis: ['ADMIN', 'OPERADOR'],
    titulo: 'Histórico de movimentações',
    descricao: 'Consulte todas as entradas e saídas registradas',
  },
  {
    id: 'alertas',
    rotulo: 'Alertas',
    icone: TriangleAlert,
    papeis: ['ADMIN', 'OPERADOR'],
    titulo: 'Alertas de estoque',
    descricao: 'Produtos em estoque baixo ou sem estoque',
  },
  {
    id: 'relatorios',
    rotulo: 'Relatórios',
    icone: FileText,
    papeis: ['ADMIN'],
    titulo: 'Relatórios e análises',
    descricao: 'Relatórios com filtros e exportação em CSV e PDF',
  },
  {
    id: 'usuarios',
    rotulo: 'Usuários',
    icone: Users,
    papeis: ['ADMIN'],
    titulo: 'Usuários e acessos',
    descricao: 'Gerenciamento de contas e permissões do sistema',
  },
]

const IDS_VALIDOS = ITENS_MENU.map((i) => i.id)

function idInicial(): IdView {
  const hash = typeof window !== 'undefined' ? window.location.hash.replace('#/', '') : ''
  return (IDS_VALIDOS.includes(hash as IdView) ? hash : 'dashboard') as IdView
}

export function AppShell({
  usuario,
  aoSair,
}: {
  usuario: UsuarioSessao
  aoSair: () => void
}) {
  const [vista, setVista] = useState<IdView>(idInicial)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [alertasCount, setAlertasCount] = useState(0)

  const itens = useMemo(() => ITENS_MENU.filter((i) => i.papeis.includes(usuario.papel)), [usuario.papel])
  // view efetiva: se a rota atual não pertence ao papel, usa a primeira permitida
  const vistaEfetiva: IdView = itens.some((i) => i.id === vista) ? vista : (itens[0]?.id ?? 'produtos')
  const atual = itens.find((i) => i.id === vistaEfetiva) ?? itens[0]

  // sincroniza com hash do navegador (voltar/avançar)
  useEffect(() => {
    const aoMudarHash = () => setVista(idInicial())
    window.addEventListener('hashchange', aoMudarHash)
    return () => window.removeEventListener('hashchange', aoMudarHash)
  }, [])

  const mudarVista = useCallback((id: IdView) => {
    setVista(id)
    window.location.hash = `#/${id}`
    setMenuMobileAberto(false)
    window.scrollTo({ top: 0 })
  }, [])

  // contagem de alertas para o menu (atualizada periodicamente)
  useEffect(() => {
    let cancelado = false
    const executar = async () => {
      try {
        const r = await api.get<{ resumo: { total: number } }>('/api/alertas')
        if (!cancelado) setAlertasCount(r.resumo.total)
      } catch {
        // silencioso
      }
    }
    const t0 = setTimeout(executar, 100)
    const t = setInterval(executar, 60000)
    return () => {
      cancelado = true
      clearTimeout(t0)
      clearInterval(t)
    }
  }, [])

  const sair = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // encerra mesmo assim
    }
    limparToken()
    toast.info('Sessão encerrada.')
    aoSair()
  }

  const iniciais = usuario.nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const navegar = (
    <nav className="flex flex-col gap-1 flex-1 overflow-y-auto scroll-fino py-2">
      {itens.map((item) => {
        const Icone = item.icone
        const ativo = item.id === vistaEfetiva
        return (
          <button
            key={item.id}
            onClick={() => mudarVista(item.id)}
            className={cn(
              'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              ativo
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            )}
            aria-current={ativo ? 'page' : undefined}
          >
            <Icone className={cn('h-[18px] w-[18px] shrink-0', ativo ? 'text-white' : 'text-slate-400 group-hover:text-slate-200')} />
            <span className="flex-1 text-left">{item.rotulo}</span>
            {item.id === 'alertas' && alertasCount > 0 && (
              <span
                className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                  ativo ? 'bg-white text-emerald-700' : 'bg-red-500 text-white'
                )}
              >
                {alertasCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )

  const conteudoVista = () => {
    switch (vistaEfetiva) {
      case 'dashboard':
        return <DashboardView aoNavegar={mudarVista} />
      case 'produtos':
        return <ProdutosView aoMovimentar={mudarVista} />
      case 'categorias':
        return <CategoriasView />
      case 'movimentar':
        return <MovimentarView aoNavegar={mudarVista} />
      case 'historico':
        return <HistoricoView />
      case 'alertas':
        return <AlertasView aoMovimentar={mudarVista} />
      case 'relatorios':
        return <RelatoriosView />
      case 'usuarios':
        return <UsuariosView usuarioAtual={usuario} />
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ---------- menu lateral (desktop) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex px-3 py-4 border-r border-slate-800">
        <div className="px-2 pb-4 pt-1">
          <Logo claro />
        </div>
        <div className="h-px bg-white/10 mb-2" />
        {navegar}
        <div className="h-px bg-white/10 my-2" />
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600/90 text-xs font-bold text-white">
            {iniciais}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{usuario.nome}</p>
            <p className="text-[11px] text-slate-400">
              {usuario.papel === 'ADMIN' ? 'Administrador' : 'Operador'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={sair}
            title="Sair do sistema"
            className="h-8 w-8 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* ---------- conteúdo ---------- */}
      <div className="flex min-h-screen w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/95 backdrop-blur px-4 sm:px-6">
          {/* hambúrguer mobile */}
          <Sheet open={menuMobileAberto} onOpenChange={setMenuMobileAberto}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden h-9 w-9" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar border-slate-800 p-3 flex flex-col">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <div className="px-2 py-3">
                <Logo claro />
              </div>
              <div className="h-px bg-white/10 mb-2" />
              {navegar}
              <div className="h-px bg-white/10 my-2" />
              <button
                onClick={sair}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-[18px] w-[18px] text-slate-400" /> Sair
              </button>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <Logo variante="icone" tamanhoIcone={20} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm sm:text-base font-semibold text-slate-900">{atual.titulo}</h2>
            <p className="hidden sm:block truncate text-xs text-muted-foreground">{atual.descricao}</p>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <Badge variant="outline" className="gap-1.5 bg-slate-50">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              EstoquePro
            </Badge>
            <div className="flex items-center gap-2.5 rounded-full border bg-white py-1 pl-1 pr-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full gradiente-marca text-xs font-bold text-white">
                {iniciais}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-slate-800">{usuario.nome}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {usuario.papel === 'ADMIN' ? 'Administrador' : 'Operador'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1400px] w-full mx-auto">{conteudoVista()}</main>

        <footer className="border-t bg-white px-6 py-4">
          <p className="text-center text-xs text-muted-foreground">
            EstoquePro · Sistema profissional de gerenciamento de estoque · Dados persistentes em banco relacional
          </p>
        </footer>
      </div>
    </div>
  )
}
