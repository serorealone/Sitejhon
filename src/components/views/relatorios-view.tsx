/**
 * EstoquePro — Relatórios e análises (papel ADMIN)
 * 8 relatórios com filtros combinados e exportação em CSV e PDF.
 */
import { useCallback, useEffect, useState } from 'react'
import { FileDown, FileText, FileType, RefreshCw } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EstadoVazio, PageHeader, SelecionarProduto, type ProdutoResumo } from '@/components/shared'
import { ApiClientError, api, baixarArquivo } from '@/lib/api'
import { dataHora, moeda, numero, separarDataHora } from '@/lib/format'
import { toast } from 'sonner'

interface Coluna {
  chave: string
  rotulo: string
  tipo?: 'texto' | 'numero' | 'moeda' | 'data'
}

interface Relatorio {
  tipo: string
  titulo: string
  subtitulo?: string
  colunas: Coluna[]
  linhas: Record<string, unknown>[]
  resumo: Record<string, string | number>
}

interface Categoria {
  id: number
  nome: string
}

const TIPOS_RELATORIO: { id: string; nome: string; descricao: string }[] = [
  { id: 'produtos-geral', nome: 'Relatório geral de produtos', descricao: 'Catálogo ativo com situação e valores' },
  { id: 'por-categoria', nome: 'Relatório por categoria', descricao: 'Consolidado por categoria' },
  { id: 'estoque-baixo', nome: 'Relatório de estoque baixo', descricao: 'Itens abaixo ou igual ao mínimo' },
  { id: 'sem-estoque', nome: 'Relatório de produtos sem estoque', descricao: 'Itens zerados' },
  { id: 'entradas', nome: 'Relatório de entradas', descricao: 'Movimentações de entrada no período' },
  { id: 'saidas', nome: 'Relatório de saídas', descricao: 'Movimentações de saída no período' },
  { id: 'movimentacoes', nome: 'Movimentações por período', descricao: 'Entradas e saídas combinadas' },
  { id: 'mais-movimentados', nome: 'Produtos com maior movimentação', descricao: 'Ranking por unidades movimentadas' },
]

const usaPeriodo = (tipo: string) => ['entradas', 'saidas', 'movimentacoes', 'mais-movimentados'].includes(tipo)
const usaTipoMovimento = (tipo: string) => tipo === 'movimentacoes'

export function RelatoriosView() {
  const [tipo, setTipo] = useState('produtos-geral')
  const [produto, setProduto] = useState<ProdutoResumo | null>(null)
  const [filtros, setFiltros] = useState({ categoriaId: '', tipoMovimento: 'todos', de: '', ate: '' })
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        setCategorias(await api.get<Categoria[]>('/api/categorias/resumo'))
      } catch {
        // silencioso
      }
    })()
  }, [])

  const construirQuery = useCallback(
    (comTokenIgnorado?: boolean) => {
      const params = new URLSearchParams({ tipo })
      if (produto) params.set('produtoId', String(produto.id))
      if (filtros.categoriaId) params.set('categoriaId', filtros.categoriaId)
      if (usaTipoMovimento(tipo) && filtros.tipoMovimento !== 'todos') {
        params.set('tipoMovimento', filtros.tipoMovimento)
      }
      if (filtros.de) params.set('de', filtros.de)
      if (filtros.ate) params.set('ate', filtros.ate)
      return params.toString()
    },
    [tipo, produto, filtros]
  )

  const gerar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await api.get<Relatorio>(`/api/relatorios?${construirQuery()}`)
      setRelatorio(r)
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) return
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar relatório.')
    } finally {
      setCarregando(false)
    }
  }, [construirQuery])

  // gera o primeiro relatório ao abrir a tela
  useEffect(() => {
    gerar()
  }, [gerar])

  const mudarTipo = (novo: string) => {
    setTipo(novo)
    if (!usaPeriodo(novo) && !usaTipoMovimento(novo)) {
      // mantém filtros; a API ignora os não aplicáveis
    }
  }

  const exportarCSV = async () => {
    setExportando(true)
    try {
      await baixarArquivo(`/api/relatorios/csv?${construirQuery()}`, `relatorio-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('CSV exportado com sucesso.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao exportar CSV.')
    } finally {
      setExportando(false)
    }
  }

  const exportarPDF = () => {
    if (!relatorio) return
    try {
      const doc = new jsPDF({ orientation: relatorio.colunas.length > 7 ? 'landscape' : 'portrait', unit: 'mm' })
      const largura = doc.internal.pageSize.getWidth()

      // cabeçalho
      doc.setFillColor(5, 150, 105)
      doc.rect(0, 0, largura, 22, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('EstoquePro', 14, 10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Sistema profissional de gerenciamento de estoque', 14, 16)

      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(relatorio.titulo, 14, 32)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(90, 90, 90)
      if (relatorio.subtitulo) doc.text(relatorio.subtitulo, 14, 37.5)
      doc.text(`Emitido em: ${dataHora(new Date())}`, largura - 14, 32, { align: 'right' })

      // resumo
      const entradasResumo = Object.entries(relatorio.resumo)
      let y = 44
      if (entradasResumo.length > 0) {
        doc.setFontSize(9)
        doc.setTextColor(20, 20, 20)
        doc.setFont('helvetica', 'bold')
        doc.text('Resumo:', 14, y)
        doc.setFont('helvetica', 'normal')
        const texto = entradasResumo
          .map(([k, v]) => {
            const rotulo = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
            return `${rotulo}: ${typeof v === 'number' && !Number.isInteger(v) ? moeda(v) : numero(v)}`.replace(
              'Total ',
              'Total '
            )
          })
          .join('   |   ')
        const linhas = doc.splitTextToSize(texto, largura - 28)
        doc.text(linhas, 34, y)
        y += linhas.length * 5 + 3
      }

      autoTable(doc, {
        startY: y,
        head: [relatorio.colunas.map((c) => c.rotulo)],
        body: relatorio.linhas.map((l) =>
          relatorio.colunas.map((c) => {
            const v = l[c.chave]
            if (v === null || v === undefined) return '—'
            if (c.tipo === 'moeda') return moeda(Number(v))
            if (c.tipo === 'numero') return numero(Number(v))
            if (c.tipo === 'data') return separarDataHora(String(v)).data + ' ' + separarDataHora(String(v)).hora
            return String(v)
          })
        ),
        styles: { fontSize: 8, cellPadding: 1.6 },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [244, 247, 246] },
        margin: { left: 14, right: 14 },
      })

      const totalPaginas = doc.getNumberOfPages()
      for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(130, 130, 130)
        doc.text(
          `EstoquePro · Página ${i} de ${totalPaginas}`,
          largura / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        )
      }

      doc.save(`relatorio-${relatorio.tipo}-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success('PDF exportado com sucesso.')
    } catch {
      toast.error('Falha ao exportar PDF.')
    }
  }

  const formatarCelula = (coluna: Coluna, valor: unknown): string => {
    if (valor === null || valor === undefined) return '—'
    if (coluna.tipo === 'moeda') return moeda(Number(valor))
    if (coluna.tipo === 'numero') return numero(Number(valor))
    if (coluna.tipo === 'data') return dataHora(String(valor))
    return String(valor)
  }

  return (
    <div>
      <PageHeader
        titulo="Relatórios e análises"
        descricao="Consultas reais ao banco de dados com filtros combinados e exportação em CSV e PDF."
        acoes={
          <>
            <Button variant="outline" className="gap-2" onClick={gerar} disabled={carregando}>
              <RefreshCw className="h-4 w-4" /> Gerar
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportarCSV} disabled={exportando || !relatorio}>
              <FileDown className="h-4 w-4" /> CSV
            </Button>
            <Button className="gap-2" onClick={exportarPDF} disabled={!relatorio}>
              <FileType className="h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* ---------- seleção e filtros ---------- */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="shadow-sm py-0">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" /> Tipo de relatório
              </h3>
              <div className="space-y-1.5">
                {TIPOS_RELATORIO.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => mudarTipo(t.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      tipo === t.id
                        ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${tipo === t.id ? 'text-emerald-800' : 'text-slate-800'}`}>
                      {t.nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.descricao}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm py-0">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Filtros</h3>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Produto</Label>
                <SelecionarProduto valor={produto} aoSelecionar={setProduto} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Categoria</Label>
                <Select
                  value={filtros.categoriaId || 'todas'}
                  onValueChange={(v) => setFiltros((f) => ({ ...f, categoriaId: v === 'todas' ? '' : v }))}
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
              {usaTipoMovimento(tipo) && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo de movimentação</Label>
                  <Select
                    value={filtros.tipoMovimento}
                    onValueChange={(v) => setFiltros((f) => ({ ...f, tipoMovimento: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Entradas e saídas</SelectItem>
                      <SelectItem value="ENTRADA">Somente entradas</SelectItem>
                      <SelectItem value="SAIDA">Somente saídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {usaPeriodo(tipo) && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">De</Label>
                    <Input
                      type="date"
                      value={filtros.de}
                      onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Até</Label>
                    <Input
                      type="date"
                      value={filtros.ate}
                      onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={gerar} disabled={carregando}>
                {carregando ? 'Gerando…' : 'Aplicar filtros e gerar'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ---------- resultado ---------- */}
        <Card className="shadow-sm py-0 lg:col-span-3">
          <CardContent className="p-5">
            {carregando ? (
              <EstadoVazio mensagem="Gerando relatório…" />
            ) : !relatorio ? (
              <EstadoVazio mensagem="Selecione um relatório e clique em Gerar." />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{relatorio.titulo}</h3>
                    {relatorio.subtitulo && (
                      <p className="text-xs text-muted-foreground mt-0.5">{relatorio.subtitulo}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-slate-50">
                    {numero(relatorio.linhas.length)} linha(s)
                  </Badge>
                </div>

                {Object.keys(relatorio.resumo).length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(relatorio.resumo).map(([chave, valor]) => (
                      <div key={chave} className="rounded-lg border bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {chave
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, (s) => s.toUpperCase())
                            .trim()}
                        </p>
                        <p className="text-sm font-bold text-slate-800">
                          {typeof valor === 'number' && (chave.toLowerCase().includes('valor') || chave.toLowerCase().includes('custo'))
                            ? moeda(valor)
                            : numero(valor)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {relatorio.linhas.length === 0 ? (
                  <EstadoVazio mensagem="Nenhum resultado para os filtros informados." />
                ) : (
                  <div className="overflow-x-auto scroll-fino border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          {relatorio.colunas.map((c) => (
                            <TableHead key={c.chave} className="whitespace-nowrap">
                              {c.rotulo}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {relatorio.linhas.map((linha, i) => (
                          <TableRow key={i}>
                            {relatorio.colunas.map((c) => (
                              <TableCell
                                key={c.chave}
                                className={`whitespace-nowrap ${c.tipo === 'numero' || c.tipo === 'moeda' ? 'text-right' : ''} ${
                                  c.tipo === 'moeda' ? 'font-medium' : ''
                                }`}
                              >
                                {formatarCelula(c, linha[c.chave])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
