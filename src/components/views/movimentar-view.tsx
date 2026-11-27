/**
 * EstoquePro — Registro de entradas e saídas
 * Atualização automática do estoque com pré-visualização do novo saldo.
 */
import { useCallback, useEffect, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
import { BadgeMovimentacao, EstadoVazio, PageHeader, SelecionarProduto, type ProdutoResumo } from '@/components/shared'
import { api } from '@/lib/api'
import { dataHora, numero } from '@/lib/format'
import { toast } from 'sonner'

const MOTIVOS = ['Venda', 'Uso interno', 'Perda/Avaria', 'Ajuste de inventário', 'Outro']

interface Recente {
  id: number
  produtoNome: string
  tipo: string
  quantidade: number
  saldoResultante: number
  usuarioNome: string
  criadoEm: string
}

export function MovimentarView({ aoNavegar }: { aoNavegar: (v: 'historico') => void }) {
  const [tab, setTab] = useState<'entrada' | 'saida'>('entrada')
  const [produto, setProduto] = useState<ProdutoResumo | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erroQuantidade, setErroQuantidade] = useState<string | null>(null)
  const [erroMotivo, setErroMotivo] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [recentes, setRecentes] = useState<Recente[]>([])

  const tipo = tab === 'entrada' ? 'ENTRADA' : 'SAIDA'
  const estoqueAtual = produto ? Number(produto.quantidade) : null
  const qtd = Number(quantidade)
  const novoEstoque =
    produto && estoqueAtual !== null && Number.isInteger(qtd) && qtd > 0
      ? estoqueAtual + (tab === 'entrada' ? qtd : -qtd)
      : null

  const carregarRecentes = useCallback(async () => {
    try {
      const r = await api.get<Recente[]>('/api/movimentacoes/recentes?limite=8')
      setRecentes(r)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    carregarRecentes()
  }, [carregarRecentes])

  const trocarTab = (novo: string) => {
    setTab(novo as 'entrada' | 'saida')
    setErroQuantidade(null)
    setErroMotivo(null)
  }

  const validar = (): boolean => {
    let ok = true
    if (!produto) {
      toast.error('Selecione o produto para movimentar.')
      ok = false
    }
    if (!Number.isInteger(qtd) || qtd <= 0) {
      setErroQuantidade('Informe uma quantidade inteira maior que zero.')
      ok = false
    } else if (tab === 'saida' && estoqueAtual !== null && qtd > estoqueAtual) {
      setErroQuantidade(`Saída maior que o estoque disponível (${numero(estoqueAtual)} un).`)
      ok = false
    }
    if (tab === 'saida' && (!motivo || motivo.length < 2)) {
      setErroMotivo('Informe o motivo da saída.')
      ok = false
    }
    return ok
  }

  const abrirConfirmacao = () => {
    if (!validar()) return
    setConfirmado(true)
  }

  const registrar = async () => {
    if (!produto) return
    setProcessando(true)
    try {
      const r = await api.post<{ id: number; saldoResultante: number; estoqueAnterior: number }>(
        '/api/movimentacoes',
        {
          produtoId: produto.id,
          tipo,
          quantidade: Number(quantidade),
          motivo: tab === 'saida' ? motivo : null,
          observacao: observacao.trim() || null,
        }
      )
      toast.success(
        `${tab === 'entrada' ? 'Entrada' : 'Saída'} registrada: ${numero(Number(quantidade))} un de ${produto.nome}. Novo saldo: ${numero(r.saldoResultante)}.`
      )
      setProduto(null)
      setQuantidade('')
      setMotivo('')
      setObservacao('')
      setErroQuantidade(null)
      setErroMotivo(null)
      setConfirmado(false)
      carregarRecentes()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar movimentação.')
    } finally {
      setProcessando(false)
    }
  }

  const previsualizacao = produto && estoqueAtual !== null

  return (
    <div>
      <PageHeader
        titulo="Entradas e saídas"
        descricao="Cada movimentação atualiza o estoque automaticamente e é registrada no histórico (operação atômica)."
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ---------- formulário ---------- */}
        <Card className="shadow-sm py-0 xl:col-span-3">
          <CardContent className="p-5">
            <Tabs value={tab} onValueChange={trocarTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full max-w-md mb-5 h-11">
                <TabsTrigger value="entrada" className="gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  <ArrowUpCircle className="h-4 w-4" /> Entrada
                </TabsTrigger>
                <TabsTrigger value="saida" className="gap-2 data-[state=active]:bg-red-600 data-[state=active]:text-white">
                  <ArrowDownCircle className="h-4 w-4" /> Saída
                </TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="space-y-5 mt-0">
                <div className="space-y-1.5">
                  <Label>Produto *</Label>
                  <SelecionarProduto valor={produto} aoSelecionar={setProduto} />
                </div>

                {produto && estoqueAtual !== null && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-slate-50 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Estoque atual:</span>
                    <span className="text-lg font-bold text-slate-900">{numero(estoqueAtual)} un</span>
                    {estoqueAtual === 0 && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Produto sem estoque</Badge>
                    )}
                    {Number(produto.quantidade) <= 0 ? null : null}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-quantidade">Quantidade *</Label>
                    <Input
                      id="m-quantidade"
                      type="number"
                      min={1}
                      step={1}
                      value={quantidade}
                      onChange={(e) => {
                        setQuantidade(e.target.value)
                        setErroQuantidade(null)
                      }}
                      placeholder="Ex.: 5"
                      className="h-11"
                    />
                    {erroQuantidade && <p className="text-xs text-red-600">{erroQuantidade}</p>}
                  </div>
                  {tab === 'saida' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="m-motivo">Motivo da saída *</Label>
                      <Select
                        value={motivo}
                        onValueChange={(v) => {
                          setMotivo(v)
                          setErroMotivo(null)
                        }}
                      >
                        <SelectTrigger id="m-motivo" className="h-11">
                          <SelectValue placeholder="Selecione o motivo…" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOTIVOS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {erroMotivo && <p className="text-xs text-red-600">{erroMotivo}</p>}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="m-obs">Observação</Label>
                  <Textarea
                    id="m-obs"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder={tab === 'entrada' ? 'Ex.: compra do fornecedor X (opcional)' : 'Detalhes adicionais (opcional)'}
                    rows={2}
                  />
                </div>

                {/* pré-visualização do saldo */}
                {previsualizacao && (
                  <div
                    className={`rounded-lg border px-4 py-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${
                      novoEstoque !== null && novoEstoque < 0
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      {numero(estoqueAtual)} un (atual) → <strong>{numero(Math.abs(novoEstoque ?? 0))} un</strong> após a{' '}
                      {tab === 'entrada' ? 'entrada' : 'saída'}
                      {novoEstoque !== null && novoEstoque < 0 && ' — bloqueada: saldo insuficiente'}
                    </span>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={abrirConfirmacao}
                    disabled={!produto || !quantidade || processando}
                    className={`h-11 px-6 text-sm font-semibold gap-2 ${
                      tab === 'entrada' ? '' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {tab === 'entrada' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                    Confirmar {tab === 'entrada' ? 'entrada' : 'saída'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ---------- recentes ---------- */}
        <Card className="shadow-sm py-0 xl:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <History className="h-4 w-4 text-emerald-600" /> Movimentações recentes
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos registros do sistema</p>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => aoNavegar('historico')}>
                Ver tudo
              </Button>
            </div>
            {recentes.length === 0 ? (
              <EstadoVazio mensagem="Nenhuma movimentação registrada ainda." />
            ) : (
              <ul className="divide-y max-h-[520px] overflow-y-auto scroll-fino">
                {recentes.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <BadgeMovimentacao tipo={m.tipo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{m.produtoNome}</p>
                      <p className="text-xs text-muted-foreground">
                        {dataHora(m.criadoEm)} · {m.usuarioNome}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${m.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.tipo === 'ENTRADA' ? '+' : '−'}
                        {numero(m.quantidade)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">saldo: {numero(m.saldoResultante)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* confirmação */}
      <AlertDialog open={confirmado} onOpenChange={setConfirmado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar {tab === 'entrada' ? 'entrada' : 'saída'} de {numero(qtd)} un?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{produto?.nome}</strong> (SKU {produto?.sku})
                </p>
                <p>
                  {numero(estoqueAtual ?? 0)} un → <strong>{numero(Math.abs(novoEstoque ?? 0))} un</strong> após a operação.
                </p>
                {tab === 'saida' && motivo && <p>Motivo: <strong>{motivo}</strong></p>}
                <p className="text-xs">
                  A operação é atômica: estoque e histórico são atualizados juntos, ou nada é alterado.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                registrar()
              }}
              className={tab === 'entrada' ? '' : 'bg-red-600 hover:bg-red-700'}
              disabled={processando}
            >
              {processando ? 'Registrando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
