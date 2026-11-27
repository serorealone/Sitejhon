/**
 * EstoquePro — Alertas de estoque (papel ADMIN e OPERADOR)
 */
import { useCallback, useEffect, useState } from 'react'
import { ArrowUpCircle, PackageX, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BadgeSituacao, EstadoVazio, PageHeader } from '@/components/shared'
import { api } from '@/lib/api'
import { numero } from '@/lib/format'
import { toast } from 'sonner'
import type { IdView } from '@/components/app-shell'

interface Alerta {
  id: number
  nome: string
  sku: string
  categoriaNome: string
  quantidade: number
  estoqueMinimo: number
  situacao: string
}

export function AlertasView({ aoMovimentar }: { aoMovimentar: (v: IdView) => void }) {
  const [dados, setDados] = useState<Alerta[]>([])
  const [resumo, setResumo] = useState({ semEstoque: 0, estoqueBaixo: 0, total: 0 })
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await api.get<{ produtos: Alerta[]; resumo: typeof resumo }>('/api/alertas')
      setDados(r.produtos)
      setResumo(r.resumo)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao carregar alertas.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <div>
      <PageHeader
        titulo="Alertas de estoque"
        descricao="Produtos ativos em estoque baixo (igual ou abaixo do mínimo configurado) ou sem estoque (zerados)."
        acoes={
          <Button variant="outline" onClick={carregar}>
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100">
            <PackageX className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-red-700">Sem estoque</p>
            <p className="text-2xl font-bold text-red-800">{numero(resumo.semEstoque)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
            <TrendingDown className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Estoque baixo</p>
            <p className="text-2xl font-bold text-amber-800">{numero(resumo.estoqueBaixo)}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-white px-5 py-4 flex items-center gap-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
            <span className="text-sm font-bold text-slate-600">Σ</span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total em alerta</p>
            <p className="text-2xl font-bold text-slate-800">{numero(resumo.total)}</p>
          </div>
        </div>
      </div>

      <Card className="shadow-sm py-0">
        <CardContent className="p-0">
          {carregando ? (
            <EstadoVazio mensagem="Carregando alertas…" />
          ) : dados.length === 0 ? (
            <EstadoVazio mensagem="Nenhum produto em alerta — todo o estoque está saudável." />
          ) : (
            <div className="overflow-x-auto scroll-fino">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Qtd. atual</TableHead>
                    <TableHead className="text-right">Qtd. mínima</TableHead>
                    <TableHead className="text-center">Situação</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium text-slate-900">{p.nome}</p>
                        <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 whitespace-nowrap">{p.categoriaNome}</TableCell>
                      <TableCell className={`text-right font-bold ${Number(p.quantidade) === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {numero(p.quantidade)}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">{numero(p.estoqueMinimo)}</TableCell>
                      <TableCell className="text-center">
                        <BadgeSituacao situacao={p.situacao} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => aoMovimentar('movimentar')}
                        >
                          <ArrowUpCircle className="h-3.5 w-3.5" /> Registrar entrada
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
