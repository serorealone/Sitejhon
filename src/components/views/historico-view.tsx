/**
 * EstoquePro — Histórico de movimentações
 * Filtros: produto, categoria, tipo, período e busca livre; ordenação por data.
 */
import { useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  BadgeMovimentacao,
  ControlesPaginacao,
  EstadoVazio,
  PageHeader,
  SelecionarProduto,
  type ProdutoResumo,
} from '@/components/shared'
import { api } from '@/lib/api'
import { numero, separarDataHora } from '@/lib/format'
import { toast } from 'sonner'

interface Movimentacao {
  id: number
  produtoNome: string
  sku: string
  categoriaNome: string
  tipo: string
  quantidade: number
  motivo: string | null
  observacao: string | null
  saldoResultante: number
  usuarioNome: string
  criadoEm: string
}

interface Categoria {
  id: number
  nome: string
}

export function HistoricoView() {
  const [dados, setDados] = useState<Movimentacao[]>([])
  const [meta, setMeta] = useState({ pagina: 1, totalPaginas: 1, total: 0 })
  const [resumo, setResumo] = useState({ unidadesEntrada: 0, unidadesSaida: 0 })
  const [carregando, setCarregando] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [dir, setDir] = useState<'DESC' | 'ASC'>('DESC')

  const [produto, setProduto] = useState<ProdutoResumo | null>(null)
  const [filtros, setFiltros] = useState({ categoriaId: '', tipo: 'todos', de: '', ate: '', busca: '' })
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtros)
  const [categorias, setCategorias] = useState<Categoria[]>([])

  useEffect(() => {
    const t = setTimeout(() => setFiltrosAplicados(filtros), 400)
    return () => clearTimeout(t)
  }, [filtros])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams({ page: String(pagina), limit: '15', ordem: 'criado_em', dir })
      if (produto) params.set('produtoId', String(produto.id))
      if (filtrosAplicados.categoriaId) params.set('categoriaId', filtrosAplicados.categoriaId)
      if (filtrosAplicados.tipo !== 'todos') params.set('tipo', filtrosAplicados.tipo)
      if (filtrosAplicados.de) params.set('de', filtrosAplicados.de)
      if (filtrosAplicados.ate) params.set('ate', filtrosAplicados.ate)
      if (filtrosAplicados.busca.trim()) params.set('busca', filtrosAplicados.busca.trim())
      const r = await api.get<{
        dados: Movimentacao[]
        meta: typeof meta
        resumo: typeof resumo
      }>(`/api/movimentacoes?${params.toString()}`)
      setDados(r.dados)
      setMeta(r.meta)
      setResumo(r.resumo)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar histórico.')
    } finally {
      setCarregando(false)
    }
  }, [produto, filtrosAplicados, pagina, dir])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    ;(async () => {
      try {
        setCategorias(await api.get<Categoria[]>('/api/categorias/resumo'))
      } catch {
        // silencioso
      }
    })()
  }, [])

  const limpar = () => {
    setProduto(null)
    const vazio = { categoriaId: '', tipo: 'todos', de: '', ate: '', busca: '' }
    setFiltros(vazio)
    setFiltrosAplicados(vazio)
    setPagina(1)
    setDir('DESC')
  }

  const setFiltro = (campo: keyof typeof filtros, valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  return (
    <div>
      <PageHeader
        titulo="Histórico de movimentações"
        descricao="Registro permanente e imutável — exclusões de produtos nunca apagam o histórico."
        acoes={
          <Button variant="outline" className="gap-2" onClick={limpar}>
            <RotateCcw className="h-4 w-4" /> Limpar filtros
          </Button>
        }
      />

      {/* resumo do filtro atual */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Unidades no filtro</p>
          <p className="text-lg font-bold text-emerald-700">+{numero(resumo.unidadesEntrada)} entrada(s)</p>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saídas no filtro</p>
          <p className="text-lg font-bold text-red-700">−{numero(resumo.unidadesSaida)} un</p>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Registros</p>
          <p className="text-lg font-bold text-slate-800">{numero(meta.total)}</p>
        </div>
      </div>

      {/* filtros */}
      <Card className="shadow-sm py-0 mb-5">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="xl:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Produto</Label>
              <SelecionarProduto valor={produto} aoSelecionar={(p) => { setProduto(p); setPagina(1) }} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Categoria</Label>
              <Select
                value={filtros.categoriaId || 'todas'}
                onValueChange={(v) => setFiltro('categoriaId', v === 'todas' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo</Label>
              <Select value={filtros.tipo} onValueChange={(v) => setFiltro('tipo', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Entradas e saídas</SelectItem>
                  <SelectItem value="ENTRADA">Somente entradas</SelectItem>
                  <SelectItem value="SAIDA">Somente saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">De</Label>
              <Input type="date" value={filtros.de} onChange={(e) => setFiltro('de', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Até</Label>
              <Input type="date" value={filtros.ate} onChange={(e) => setFiltro('ate', e.target.value)} />
            </div>
          </div>
          <div className="mt-3 max-w-md relative">
            <Input
              placeholder="Buscar em produto, SKU, motivo ou observação…"
              value={filtros.busca}
              onChange={(e) => setFiltro('busca', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* tabela */}
      <Card className="shadow-sm py-0">
        <CardContent className="p-0">
          {carregando ? (
            <EstadoVazio mensagem="Carregando histórico…" />
          ) : dados.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma movimentação encontrada com os filtros atuais." />
          ) : (
            <>
              <div className="overflow-x-auto scroll-fino">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => {
                          setDir(dir === 'DESC' ? 'ASC' : 'DESC')
                          setPagina(1)
                        }}
                        title="Ordenar por data"
                      >
                        Data / hora {dir === 'DESC' ? '▼' : '▲'}
                      </TableHead>
                      <TableHead className="whitespace-nowrap">ID</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Saldo resultante</TableHead>
                      <TableHead className="hidden lg:table-cell">Motivo / observação</TableHead>
                      <TableHead className="hidden xl:table-cell">Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.map((m) => {
                      const dh = separarDataHora(m.criadoEm)
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="whitespace-nowrap">
                            <p className="text-sm font-medium text-slate-800">{dh.data}</p>
                            <p className="text-xs text-muted-foreground">{dh.hora}</p>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-muted-foreground">#{m.id}</span>
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <p className="text-sm font-medium text-slate-800 truncate">{m.produtoNome}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-mono">{m.sku}</span> · {m.categoriaNome}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">
                            <BadgeMovimentacao tipo={m.tipo} />
                          </TableCell>
                          <TableCell
                            className={`text-right font-bold ${
                              m.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {m.tipo === 'ENTRADA' ? '+' : '−'}
                            {numero(m.quantidade)}
                          </TableCell>
                          <TableCell className="text-right text-slate-700">{numero(m.saldoResultante)}</TableCell>
                          <TableCell className="hidden lg:table-cell max-w-[240px]">
                            {m.motivo && <p className="text-sm text-slate-700">{m.motivo}</p>}
                            {m.observacao && <p className="text-xs text-muted-foreground truncate">{m.observacao}</p>}
                            {!m.motivo && !m.observacao && <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm text-muted-foreground whitespace-nowrap">
                            {m.usuarioNome}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="px-5 pb-4">
                <ControlesPaginacao
                  pagina={meta.pagina}
                  totalPaginas={meta.totalPaginas}
                  total={meta.total}
                  aoMudar={setPagina}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
