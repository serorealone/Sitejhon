/**
 * EstoquePro — Componentes compartilhados das views
 */
import { ReactNode, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  PackageX,
  TrendingDown,
  ChevronDown,
} from 'lucide-react'
import { numero, type Situacao } from '@/lib/format'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ---------------- cabeçalho de página ----------------
export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string
  descricao?: string
  acoes?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        {descricao && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}

// ---------------- cartão de indicador ----------------
export function CartaoIndicador({
  titulo,
  valor,
  icone,
  descricao,
  tonalidade = 'padrao',
}: {
  titulo: string
  valor: string | number
  icone: ReactNode
  descricao?: string
  tonalidade?: 'padrao' | 'positivo' | 'alerta' | 'critico' | 'destaque'
}) {
  const estilos: Record<string, string> = {
    padrao: 'bg-slate-100 text-slate-600',
    positivo: 'bg-emerald-100 text-emerald-700',
    alerta: 'bg-amber-100 text-amber-700',
    critico: 'bg-red-100 text-red-700',
    destaque: 'bg-teal-100 text-teal-700',
  }
  return (
    <Card className="py-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 truncate">{valor}</p>
            {descricao && <p className="text-xs text-muted-foreground mt-1">{descricao}</p>}
          </div>
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', estilos[tonalidade])}>
            {icone}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------- badge de situação de estoque ----------------
export function BadgeSituacao({ situacao }: { situacao: Situacao | string }) {
  if (situacao === 'SEM_ESTOQUE') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 gap-1">
        <PackageX className="h-3 w-3" /> Sem estoque
      </Badge>
    )
  }
  if (situacao === 'BAIXO') {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 gap-1">
        <TrendingDown className="h-3 w-3" /> Estoque baixo
      </Badge>
    )
  }
  return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Normal</Badge>
}

export function BadgeMovimentacao({ tipo }: { tipo: string }) {
  if (tipo === 'ENTRADA') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Entrada</Badge>
    )
  }
  return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Saída</Badge>
}

// ---------------- paginação ----------------
export function ControlesPaginacao({
  pagina,
  totalPaginas,
  total,
  aoMudar,
}: {
  pagina: number
  totalPaginas: number
  total: number
  aoMudar: (nova: number) => void
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <p className="text-xs text-muted-foreground">
        {numero(total)} registro(s) — página {pagina} de {totalPaginas}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pagina <= 1}
          onClick={() => aoMudar(pagina - 1)}
          className="gap-1 h-8"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pagina >= totalPaginas}
          onClick={() => aoMudar(pagina + 1)}
          className="gap-1 h-8"
        >
          Próxima <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ---------------- estado vazio ----------------
export function EstadoVazio({ mensagem = 'Nenhum registro encontrado', icone }: { mensagem?: string; icone?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-3 text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        {icone ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="text-sm">{mensagem}</p>
    </div>
  )
}

// ---------------- seletor de produto (combobox com busca) ----------------
export interface ProdutoResumo {
  id: number
  nome: string
  sku: string
  quantidade: number
  categoriaNome?: string
}

export function SelecionarProduto({
  valor,
  aoSelecionar,
  desabilitados = false,
}: {
  valor: ProdutoResumo | null
  aoSelecionar: (p: ProdutoResumo | null) => void
  desabilitados?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [opcoes, setOpcoes] = useState<ProdutoResumo[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    const t = setTimeout(async () => {
      setCarregando(true)
      try {
        const r = await api.get<{ dados: ProdutoResumo[] }>(
          `/api/produtos?limit=30&ordem=nome&dir=asc&ativo=ativos&busca=${encodeURIComponent(busca)}`
        )
        if (ativo) setOpcoes(r.dados)
      } finally {
        if (ativo) setCarregando(false)
      }
    }, 250)
    return () => {
      ativo = false
      clearTimeout(t)
    }
  }, [aberto, busca])

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          disabled={desabilitados}
          className="w-full justify-between font-normal h-11"
        >
          {valor ? (
            <span className="truncate text-left">
              {valor.nome} <span className="text-xs text-muted-foreground ml-1 font-mono">{valor.sku}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione o produto…</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[360px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome ou SKU…" value={busca} onValueChange={setBusca} />
          <CommandList className="max-h-72">
            {opcoes.length === 0 && !carregando && <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>}
            <CommandGroup>
              {opcoes.map((p) => (
                <CommandItem
                  key={p.id}
                  value={String(p.id)}
                  onSelect={() => {
                    aoSelecionar(p)
                    setAberto(false)
                  }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{p.nome}</span>
                  <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-2">
                    <span className="font-mono">{p.sku}</span>
                    <span className={cn('font-medium', Number(p.quantidade) === 0 ? 'text-red-600' : 'text-emerald-700')}>
                      {numero(p.quantidade)} un
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ---------------- cartão de gráfico ----------------
export function CartaoGrafico({
  titulo,
  descricao,
  children,
  acoes,
  className,
}: {
  titulo: string
  descricao?: string
  children: ReactNode
  acoes?: ReactNode
  className?: string
}) {
  return (
    <Card className="shadow-sm py-0">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
            {descricao && <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>}
          </div>
          {acoes}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

