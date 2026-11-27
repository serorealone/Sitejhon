/**
 * EstoquePro — Gestão de categorias (CRUD completo)
 * Nome único, exclusão bloqueada quando existem produtos vinculados.
 */
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ControlesPaginacao, EstadoVazio, PageHeader } from '@/components/shared'
import { api } from '@/lib/api'
import { data, numero } from '@/lib/format'
import { toast } from 'sonner'

interface Categoria {
  id: number
  nome: string
  descricao: string | null
  criadoEm: string
  produtosVinculados: number
}

export function CategoriasView() {
  const [dados, setDados] = useState<Categoria[]>([])
  const [meta, setMeta] = useState({ pagina: 1, totalPaginas: 1, total: 0 })
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)

  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erroNome, setErroNome] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<Categoria | null>(null)
  const [processando, setProcessando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 400)
    return () => clearTimeout(t)
  }, [busca])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams({ page: String(pagina), limit: '10', ordem: 'nome', dir: 'ASC' })
      if (buscaAplicada.trim()) params.set('busca', buscaAplicada.trim())
      const r = await api.get<{ dados: Categoria[]; meta: typeof meta }>(`/api/categorias?${params.toString()}`)
      setDados(r.dados)
      setMeta(r.meta)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar categorias.')
    } finally {
      setCarregando(false)
    }
  }, [buscaAplicada, pagina])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abrirNova = () => {
    setEditando(null)
    setNome('')
    setDescricao('')
    setErroNome(null)
    setFormAberto(true)
  }

  const abrirEdicao = (c: Categoria) => {
    setEditando(c)
    setNome(c.nome)
    setDescricao(c.descricao ?? '')
    setErroNome(null)
    setFormAberto(true)
  }

  const salvar = async () => {
    if (nome.trim().length < 2) {
      setErroNome('Informe o nome da categoria (mín. 2 caracteres).')
      return
    }
    setSalvando(true)
    try {
      if (editando) {
        await api.patch(`/api/categorias/${editando.id}`, { nome: nome.trim(), descricao: descricao.trim() || null })
        toast.success('Categoria atualizada com sucesso.')
      } else {
        await api.post('/api/categorias', { nome: nome.trim(), descricao: descricao.trim() || null })
        toast.success('Categoria cadastrada com sucesso.')
      }
      setFormAberto(false)
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar categoria.')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    setProcessando(true)
    try {
      await api.del(`/api/categorias/${excluindo.id}`)
      toast.success('Categoria excluída com sucesso.')
      setExcluindo(null)
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir categoria.')
      setExcluindo(null)
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Categorias"
        descricao="Organize os produtos por categoria. A exclusão é bloqueada quando existem produtos vinculados."
        acoes={
          <Button onClick={abrirNova} className="gap-2">
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        }
      />

      <Card className="shadow-sm py-0 mb-5">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar categoria por nome ou descrição…"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setPagina(1)
              }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm py-0">
        <CardContent className="p-0">
          {carregando ? (
            <EstadoVazio mensagem="Carregando categorias…" />
          ) : dados.length === 0 ? (
            <EstadoVazio mensagem="Nenhuma categoria encontrada." />
          ) : (
            <>
              <div className="overflow-x-auto scroll-fino">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden md:table-cell">Descrição</TableHead>
                      <TableHead className="text-center">Produtos vinculados</TableHead>
                      <TableHead className="hidden sm:table-cell">Criada em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-slate-900">{c.nome}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px]">
                          <span className="line-clamp-2">{c.descricao ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              Number(c.produtosVinculados) > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-500'
                            }
                          >
                            {numero(c.produtosVinculados)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {data(c.criadoEm)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500"
                              title="Editar"
                              onClick={() => abrirEdicao(c)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${
                                Number(c.produtosVinculados) > 0 ? 'text-slate-300 cursor-not-allowed' : 'text-red-600'
                              }`}
                              title={
                                Number(c.produtosVinculados) > 0
                                  ? 'Bloqueado: existem produtos vinculados'
                                  : 'Excluir'
                              }
                              onClick={() =>
                                Number(c.produtosVinculados) > 0
                                  ? toast.error(
                                      `Categoria não pode ser excluída: ${numero(c.produtosVinculados)} produto(s) vinculado(s).`
                                    )
                                  : setExcluindo(c)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      {/* modal do formulário */}
      <Dialog open={formAberto} onOpenChange={(aberto) => !aberto && setFormAberto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
            <DialogDescription>
              O nome da categoria deve ser único no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-nome">Nome *</Label>
              <Input
                id="c-nome"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value)
                  setErroNome(null)
                }}
                placeholder="Ex.: Bebidas"
              />
              {erroNome && <p className="text-xs text-red-600">{erroNome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-desc">Descrição</Label>
              <Textarea
                id="c-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Finalidade da categoria (opcional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* confirmação de exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(aberto) => !aberto && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo && (
                <>
                  Você está excluindo <strong>{excluindo.nome}</strong>. A exclusão só é permitida quando nenhum
                  produto está vinculado a ela.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmarExclusao()
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={processando}
            >
              {processando ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
