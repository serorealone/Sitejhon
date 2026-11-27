/**
 * EstoquePro — Gestão de produtos (CRUD completo)
 * Pesquisa por nome/SKU, filtro por categoria e situação, ordenação,
 * paginação, detalhes com histórico e exclusão segura.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  BadgeSituacao,
  BadgeMovimentacao,
  ControlesPaginacao,
  EstadoVazio,
  PageHeader,
} from '@/components/shared'
import { ApiClientError, api } from '@/lib/api'
import { dataHora, moeda, numero, separarDataHora, type Situacao } from '@/lib/format'
import { toast } from 'sonner'
import type { IdView } from '@/components/app-shell'

interface Produto {
  id: number
  nome: string
  descricao: string | null
  sku: string
  categoriaId: number
  categoriaNome: string
  quantidade: number
  estoqueMinimo: number
  precoCusto: number
  precoVenda: number
  ativo: boolean
  situacao: Situacao
}

interface ProdutoDetalhe extends Produto {
  estatisticas: { totalEntradas: number; totalSaidas: number; movimentacoes: number; ultimaMovimentacao: string | null }
  historicoRecente: {
    id: number
    tipo: string
    quantidade: number
    saldoResultante: number
    criadoEm: string
    motivo: string | null
  }[]
}

interface Categoria {
  id: number
  nome: string
}

interface Formulario {
  nome: string
  descricao: string
  sku: string
  categoriaId: string
  estoqueMinimo: string
  precoCusto: string
  precoVenda: string
  quantidadeInicial: string
}

const FORMULARIO_VAZIO: Formulario = {
  nome: '',
  descricao: '',
  sku: '',
  categoriaId: '',
  estoqueMinimo: '0',
  precoCusto: '',
  precoVenda: '',
  quantidadeInicial: '0',
}

export function ProdutosView({ aoMovimentar }: { aoMovimentar: (v: IdView) => void }) {
  // lista
  const [dados, setDados] = useState<Produto[]>([])
  const [meta, setMeta] = useState({ pagina: 1, totalPaginas: 1, total: 0 })
  const [carregando, setCarregando] = useState(true)
  const [filtros, setFiltros] = useState({ busca: '', sku: '', categoriaId: '', status: 'todos', ativo: 'ativos' })
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtros)
  const [ordem, setOrdem] = useState('nome')
  const [dir, setDir] = useState<'ASC' | 'DESC'>('ASC')
  const [pagina, setPagina] = useState(1)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  // modais
  const [detalhe, setDetalhe] = useState<ProdutoDetalhe | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState<Formulario>(FORMULARIO_VAZIO)
  const [errosForm, setErrosForm] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<Produto | null>(null)
  const [processandoAcao, setProcessandoAcao] = useState(false)

  // debounce dos filtros de texto (evita requisição por tecla)
  useEffect(() => {
    const t = setTimeout(() => setFiltrosAplicados(filtros), 400)
    return () => clearTimeout(t)
  }, [filtros])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pagina))
      params.set('limit', '10')
      if (filtrosAplicados.busca.trim()) params.set('busca', filtrosAplicados.busca.trim())
      if (filtrosAplicados.sku.trim()) params.set('sku', filtrosAplicados.sku.trim())
      if (filtrosAplicados.categoriaId) params.set('categoriaId', filtrosAplicados.categoriaId)
      if (filtrosAplicados.status !== 'todos') params.set('status', filtrosAplicados.status)
      if (filtrosAplicados.ativo) params.set('ativo', filtrosAplicados.ativo)
      params.set('ordem', ordem)
      params.set('dir', dir)
      const r = await api.get<{ dados: Produto[]; meta: typeof meta }>(`/api/produtos?${params.toString()}`)
      setDados(r.dados)
      setMeta(r.meta)
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) return
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar produtos.')
    } finally {
      setCarregando(false)
    }
  }, [filtrosAplicados, ordem, dir, pagina])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    ;(async () => {
      try {
        const r = await api.get<{ id: number; nome: string }[]>('/api/categorias/resumo')
        setCategorias(r)
        const eu = await api.get<{ papel: string }>('/api/auth/me')
        setIsAdmin(eu.papel === 'ADMIN')
      } catch {
        // silencioso
      }
    })()
  }, [])

  const ordenarPor = (coluna: string) => {
    if (ordem === coluna) {
      setDir(dir === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setOrdem(coluna)
      setDir('ASC')
    }
    setPagina(1)
  }

  const limparFiltros = () => {
    const vazio = { busca: '', sku: '', categoriaId: '', status: 'todos', ativo: 'ativos' }
    setFiltros(vazio)
    setFiltrosAplicados(vazio)
    setPagina(1)
  }

  // ---------- detalhes ----------
  const abrirDetalhes = async (p: Produto) => {
    try {
      const d = await api.get<ProdutoDetalhe>(`/api/produtos/${p.id}`)
      setDetalhe(d)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao abrir detalhes.')
    }
  }

  // ---------- formulário ----------
  const abrirNovo = () => {
    setEditando(null)
    setForm(FORMULARIO_VAZIO)
    setErrosForm({})
    setFormAberto(true)
  }

  const abrirEdicao = (p: Produto) => {
    setEditando(p)
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? '',
      sku: p.sku,
      categoriaId: String(p.categoriaId),
      estoqueMinimo: String(p.estoqueMinimo),
      precoCusto: String(p.precoCusto),
      precoVenda: String(p.precoVenda),
      quantidadeInicial: '0',
    })
    setErrosForm({})
    setFormAberto(true)
  }

  const validarFormulario = (): boolean => {
    const erros: Record<string, string> = {}
    if (form.nome.trim().length < 2) erros.nome = 'Informe o nome do produto (mín. 2 caracteres).'
    if (!/^[A-Z0-9][A-Z0-9\-_]{1,23}$/.test(form.sku.trim().toUpperCase()))
      erros.sku = 'SKU: 2–24 caracteres alfanuméricos (pode usar - e _).'
    if (!form.categoriaId) erros.categoriaId = 'Selecione a categoria.'
    const minimo = Number(form.estoqueMinimo)
    if (!Number.isInteger(minimo) || minimo < 0) erros.estoqueMinimo = 'Estoque mínimo deve ser inteiro >= 0.'
    const custo = Number(form.precoCusto)
    if (Number.isNaN(custo) || custo < 0) erros.precoCusto = 'Preço de custo não pode ser negativo.'
    const venda = Number(form.precoVenda)
    if (Number.isNaN(venda) || venda < 0) erros.precoVenda = 'Preço de venda não pode ser negativo.'
    if (!editando) {
      const inicial = Number(form.quantidadeInicial)
      if (!Number.isInteger(inicial) || inicial < 0)
        erros.quantidadeInicial = 'Quantidade inicial deve ser inteira >= 0.'
    }
    setErrosForm(erros)
    return Object.keys(erros).length === 0
  }

  const salvar = async () => {
    if (!validarFormulario()) return
    setSalvando(true)
    try {
      const corpo = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        sku: form.sku.trim().toUpperCase(),
        categoriaId: Number(form.categoriaId),
        estoqueMinimo: Number(form.estoqueMinimo),
        precoCusto: Number(form.precoCusto),
        precoVenda: Number(form.precoVenda),
      }
      if (editando) {
        await api.patch(`/api/produtos/${editando.id}`, corpo)
        toast.success('Produto atualizado com sucesso.')
      } else {
        await api.post('/api/produtos', {
          ...corpo,
          quantidadeInicial: Number(form.quantidadeInicial) || 0,
        })
        toast.success('Produto cadastrado com sucesso.')
      }
      setFormAberto(false)
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar produto.')
    } finally {
      setSalvando(false)
    }
  }

  // ---------- exclusão / arquivamento ----------
  const confirmarExclusao = async () => {
    if (!excluindo) return
    setProcessandoAcao(true)
    try {
      await api.del(`/api/produtos/${excluindo.id}`)
      toast.success('Produto excluído com sucesso.')
      setExcluindo(null)
      carregar()
    } catch (e) {
      if (e instanceof ApiClientError && e.detalhes && typeof e.detalhes === 'object') {
        const d = e.detalhes as { sugerirArquivamento?: boolean }
        if (d.sugerirArquivamento) {
          toast.info(e.message, { description: 'Você pode arquivá-lo para preservar o histórico.', duration: 8000 })
          setExcluindo(null)
          return
        }
      }
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir produto.')
    } finally {
      setProcessandoAcao(false)
    }
  }

  const arquivar = async (p: Produto) => {
    try {
      await api.patch(`/api/produtos/${p.id}/arquivar`, { arquivar: p.ativo })
      toast.success(p.ativo ? 'Produto arquivado. O histórico foi preservado.' : 'Produto restaurado ao catálogo ativo.')
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao arquivar produto.')
    }
  }

  const setFiltro = (campo: keyof typeof filtros, valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  const iconeOrdenacao = (coluna: string) =>
    ordem === coluna ? (dir === 'ASC' ? ' ▲' : ' ▼') : ''

  return (
    <div>
      <PageHeader
        titulo="Produtos"
        descricao="Catálogo com quantidade gerenciada por movimentações de estoque."
        acoes={
          isAdmin && (
            <Button onClick={abrirNovo} className="gap-2">
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          )
        }
      />

      {/* ---------- filtros ---------- */}
      <Card className="shadow-sm py-0 mb-5">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome…"
                value={filtros.busca}
                onChange={(e) => setFiltro('busca', e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="SKU"
                value={filtros.sku}
                onChange={(e) => setFiltro('sku', e.target.value)}
                className="pl-9 font-mono"
              />
            </div>
            <Select value={filtros.categoriaId || 'todas'} onValueChange={(v) => setFiltro('categoriaId', v === 'todas' ? '' : v)}>
              <SelectTrigger aria-label="Filtrar por categoria">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtros.status} onValueChange={(v) => setFiltro('status', v)}>
              <SelectTrigger aria-label="Filtrar por situação">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="baixo">Estoque baixo</SelectItem>
                <SelectItem value="sem">Sem estoque</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={filtros.ativo} onValueChange={(v) => setFiltro('ativo', v)}>
                <SelectTrigger aria-label="Filtrar por arquivados">
                  <SelectValue placeholder="Situação do cadastro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="arquivados">Arquivados</SelectItem>
                  <SelectItem value="todos">Todos os cadastros</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={limparFiltros}>
              <RotateCcw className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------- tabela ---------- */}
      <Card className="shadow-sm py-0">
        <CardContent className="p-0">
          {carregando ? (
            <EstadoVazio mensagem="Carregando produtos…" />
          ) : dados.length === 0 ? (
            <EstadoVazio mensagem="Nenhum produto encontrado com os filtros atuais." />
          ) : (
            <>
              <div className="overflow-x-auto scroll-fino">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => ordenarPor('nome')}>
                        Produto{iconeOrdenacao('nome')}
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => ordenarPor('categoria')}
                      >
                        Categoria{iconeOrdenacao('categoria')}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-right whitespace-nowrap"
                        onClick={() => ordenarPor('quantidade')}
                      >
                        Qtd. atual{iconeOrdenacao('quantidade')}
                      </TableHead>
                      <TableHead className="text-center">Situação</TableHead>
                      <TableHead
                        className="cursor-pointer text-right whitespace-nowrap"
                        onClick={() => ordenarPor('preco_venda')}
                      >
                        Preço venda{iconeOrdenacao('preco_venda')}
                      </TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.map((p) => (
                      <TableRow key={p.id} className={!p.ativo ? 'opacity-60' : ''}>
                        <TableCell className="max-w-[280px]">
                          <p className="font-medium text-slate-900 truncate flex items-center gap-2">
                            {p.nome}
                            {!p.ativo && <Badge variant="outline" className="text-[10px] shrink-0">Arquivado</Badge>}
                          </p>
                          {p.descricao && (
                            <p className="text-xs text-muted-foreground truncate">{p.descricao}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs bg-slate-100 rounded px-2 py-1">{p.sku}</span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap">{p.categoriaNome}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-bold ${
                              Number(p.quantidade) === 0
                                ? 'text-red-600'
                                : Number(p.quantidade) <= Number(p.estoqueMinimo) && Number(p.estoqueMinimo) > 0
                                  ? 'text-amber-600'
                                  : 'text-slate-800'
                            }`}
                          >
                            {numero(p.quantidade)}
                          </span>
                          <span className="text-xs text-muted-foreground"> / min {numero(p.estoqueMinimo)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <BadgeSituacao situacao={p.situacao} />
                        </TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">{moeda(p.precoVenda)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500"
                              title="Ver detalhes"
                              onClick={() => abrirDetalhes(p)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500"
                                  title="Editar"
                                  onClick={() => abrirEdicao(p)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-600"
                                  title={p.ativo ? 'Arquivar' : 'Restaurar'}
                                  onClick={() => arquivar(p)}
                                >
                                  {p.ativo ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600"
                                  title="Excluir"
                                  onClick={() => setExcluindo(p)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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

      {/* ---------- modal de detalhes ---------- */}
      <Dialog open={!!detalhe} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-fino">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  {detalhe.nome}
                  <BadgeSituacao situacao={detalhe.situacao} />
                  {!detalhe.ativo && <Badge variant="outline">Arquivado</Badge>}
                </DialogTitle>
                <DialogDescription>
                  SKU <span className="font-mono">{detalhe.sku}</span> · Categoria {detalhe.categoriaNome}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Qtd. atual</p>
                  <p className="text-lg font-bold text-slate-900">{numero(detalhe.quantidade)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estoque mínimo</p>
                  <p className="text-lg font-bold text-slate-900">{numero(detalhe.estoqueMinimo)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Custo</p>
                  <p className="text-lg font-bold text-slate-900">{moeda(detalhe.precoCusto)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Venda</p>
                  <p className="text-lg font-bold text-emerald-700">{moeda(detalhe.precoVenda)}</p>
                </div>
              </div>

              {detalhe.descricao && (
                <p className="text-sm text-muted-foreground mb-2">{detalhe.descricao}</p>
              )}

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <strong className="text-emerald-700">{numero(detalhe.estatisticas.totalEntradas)}</strong> unidades de entrada (histórico)
                </span>
                <span>
                  <strong className="text-red-700">{numero(detalhe.estatisticas.totalSaidas)}</strong> unidades de saída (histórico)
                </span>
                <span>
                  {numero(detalhe.estatisticas.movimentacoes)} movimentação(ões) registradas
                </span>
                <span>Última: {dataHora(detalhe.estatisticas.ultimaMovimentacao)}</span>
              </div>

              <Separator className="my-3" />

              <h4 className="text-sm font-semibold text-slate-900 mb-2">Últimas movimentações</h4>
              {detalhe.historicoRecente.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma movimentação registrada.</p>
              ) : (
                <ul className="divide-y border rounded-lg max-h-56 overflow-y-auto scroll-fino">
                  {detalhe.historicoRecente.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                      <BadgeMovimentacao tipo={m.tipo} />
                      <span className="text-sm font-semibold w-14 text-right">
                        {m.tipo === 'ENTRADA' ? '+' : '−'}
                        {numero(m.quantidade)}
                      </span>
                      <span className="text-xs text-muted-foreground flex-1">
                        {dataHora(m.criadoEm)}
                        {m.motivo ? ` · ${m.motivo}` : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">saldo {numero(m.saldoResultante)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setDetalhe(null)
                    aoMovimentar('movimentar')
                  }}
                >
                  Registrar movimentação
                </Button>
                {isAdmin && (
                  <Button
                    className="gap-2"
                    onClick={() => {
                      const p = detalhe
                      setDetalhe(null)
                      abrirEdicao({ ...p })
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Editar produto
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- modal do formulário ---------- */}
      <Dialog open={formAberto} onOpenChange={(aberto) => !aberto && setFormAberto(false)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto scroll-fino">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>
              {editando
                ? 'A quantidade é gerenciada exclusivamente por movimentações (entradas/saídas).'
                : 'Campos com * são obrigatórios. A quantidade inicial gera uma entrada automática no histórico.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="p-nome">Nome *</Label>
              <Input
                id="p-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Água mineral 500ml (fardo)"
              />
              {errosForm.nome && <p className="text-xs text-red-600">{errosForm.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">SKU *</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                placeholder="Ex.: BEB-0009"
                className="font-mono"
              />
              {errosForm.sku && <p className="text-xs text-red-600">{errosForm.sku}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cat">Categoria *</Label>
              <Select value={form.categoriaId} onValueChange={(v) => setForm((f) => ({ ...f, categoriaId: v }))}>
                <SelectTrigger id="p-cat">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errosForm.categoriaId && <p className="text-xs text-red-600">{errosForm.categoriaId}</p>}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="p-desc">Descrição</Label>
              <Textarea
                id="p-desc"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes do produto (opcional)"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-min">Estoque mínimo *</Label>
              <Input
                id="p-min"
                type="number"
                min={0}
                value={form.estoqueMinimo}
                onChange={(e) => setForm((f) => ({ ...f, estoqueMinimo: e.target.value }))}
              />
              {errosForm.estoqueMinimo && <p className="text-xs text-red-600">{errosForm.estoqueMinimo}</p>}
            </div>
            {!editando && (
              <div className="space-y-1.5">
                <Label htmlFor="p-inicial">Quantidade inicial</Label>
                <Input
                  id="p-inicial"
                  type="number"
                  min={0}
                  value={form.quantidadeInicial}
                  onChange={(e) => setForm((f) => ({ ...f, quantidadeInicial: e.target.value }))}
                />
                {errosForm.quantidadeInicial && <p className="text-xs text-red-600">{errosForm.quantidadeInicial}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p-custo">Preço de custo (R$) *</Label>
              <Input
                id="p-custo"
                type="number"
                step="0.01"
                min={0}
                value={form.precoCusto}
                onChange={(e) => setForm((f) => ({ ...f, precoCusto: e.target.value }))}
                placeholder="0,00"
              />
              {errosForm.precoCusto && <p className="text-xs text-red-600">{errosForm.precoCusto}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-venda">Preço de venda (R$) *</Label>
              <Input
                id="p-venda"
                type="number"
                step="0.01"
                min={0}
                value={form.precoVenda}
                onChange={(e) => setForm((f) => ({ ...f, precoVenda: e.target.value }))}
                placeholder="0,00"
              />
              {errosForm.precoVenda && <p className="text-xs text-red-600">{errosForm.precoVenda}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- confirmação de exclusão ---------- */}
      <AlertDialog open={!!excluindo} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo && (
                <>
                  Você está excluindo <strong>{excluindo.nome}</strong> (SKU {excluindo.sku}). Se o produto tiver
                  movimentações registradas, a exclusão será bloqueada para preservar o histórico — nesse caso você
                  poderá <strong>arquivá-lo</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processandoAcao}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmarExclusao()
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={processandoAcao}
            >
              {processandoAcao ? 'Processando…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
