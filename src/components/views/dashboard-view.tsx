/**
 * EstoquePro — Dashboard (papel ADMIN)
 * Indicadores e gráficos construídos com dados reais da API.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeftRight, Boxes, DollarSign, Package, Tags, TrendingDown, PackageX, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CartaoGrafico,
  CartaoIndicador,
  BadgeMovimentacao,
  EstadoVazio,
  PageHeader,
} from '@/components/shared'
import { api } from '@/lib/api'
import { dataHora, moeda, numero } from '@/lib/format'
import type { IdView } from '@/components/app-shell'

interface Resumo {
  produtosAtivos: number
  categorias: number
  unidadesEstoque: number
  valorEstoque: number
  semEstoque: number
  estoqueBaixo: number
  totalEntradas: number
  totalSaidas: number
  entradas24h: number
  saidas24h: number
  movimentacoesRecentes: {
    id: number
    produtoNome: string
    tipo: string
    quantidade: number
    saldoResultante: number
    usuarioNome: string
    criadoEm: string
  }[]
  produtosMaisMovimentados: {
    id: number
    produto: string
    entradas: number
    saidas: number
    total: number
  }[]
}

interface Series {
  periodo: number
  serie: { dia: string; entradas: number; saidas: number; saldoEstoque: number }[]
  porCategoria: { categoria: string; produtos: number; unidades: number }[]
}

const CORES_CATEGORIA = ['#059669', '#f59e0b', '#0d9488', '#e11d48', '#0284c7', '#7c3aed', '#8b5cf6', '#65a30d']

export function DashboardView({ aoNavegar }: { aoNavegar: (v: IdView) => void }) {
  const [periodo, setPeriodo] = useState<30 | 7 | 90>(30)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [series, setSeries] = useState<Series | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [r, s] = await Promise.all([
        api.get<Resumo>('/api/dashboard/resumo'),
        api.get<Series>(`/api/dashboard/series?dias=${periodo}`),
      ])
      setResumo(r)
      setSeries(s)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o dashboard.')
    } finally {
      setCarregando(false)
    }
  }, [periodo])

  useEffect(() => {
    carregar()
  }, [carregar])

  const dadosFluxo = useMemo(
    () =>
      (series?.serie ?? []).map((s) => ({
        ...s,
        dia: s.dia.slice(8, 10) + '/' + s.dia.slice(5, 7),
      })),
    [series]
  )

  if (erro) {
    return (
      <div>
        <PageHeader titulo="Dashboard" descricao="Visão geral do estoque" />
        <Card>
          <CardContent className="p-8 text-center text-sm text-red-600">
            {erro}
            <Button variant="outline" size="sm" className="ml-3" onClick={carregar}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        titulo="Dashboard"
        descricao="Indicadores calculados diretamente do banco de dados — sem números fictícios."
        acoes={
          <div className="flex items-center gap-1.5 rounded-lg border bg-white p-1">
            {([7, 30, 90] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={periodo === d ? 'default' : 'ghost'}
                onClick={() => setPeriodo(d)}
                className="h-8 px-3 text-xs"
              >
                {d} dias
              </Button>
            ))}
          </div>
        }
      />

      {/* ---------- cartões de indicadores ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-6">
        <CartaoIndicador
          titulo="Produtos cadastrados"
          valor={numero(resumo?.produtosAtivos ?? 0)}
          icone={<Package className="h-5 w-5" />}
          descricao="Itens ativos no catálogo"
        />
        <CartaoIndicador
          titulo="Categorias"
          valor={numero(resumo?.categorias ?? 0)}
          icone={<Tags className="h-5 w-5" />}
          tonalidade="destaque"
          descricao="Agrupamentos cadastrados"
        />
        <CartaoIndicador
          titulo="Unidades em estoque"
          valor={numero(resumo?.unidadesEstoque ?? 0)}
          icone={<Boxes className="h-5 w-5" />}
          tonalidade="positivo"
          descricao="Soma das quantidades"
        />
        <CartaoIndicador
          titulo="Valor em estoque"
          valor={moeda(resumo?.valorEstoque ?? 0)}
          icone={<DollarSign className="h-5 w-5" />}
          tonalidade="positivo"
          descricao="Custo total dos itens"
        />
        <CartaoIndicador
          titulo="Estoque baixo"
          valor={numero(resumo?.estoqueBaixo ?? 0)}
          icone={<TrendingDown className="h-5 w-5" />}
          tonalidade="alerta"
          descricao="Abaixo ou igual ao mínimo"
        />
        <CartaoIndicador
          titulo="Sem estoque"
          valor={numero(resumo?.semEstoque ?? 0)}
          icone={<PackageX className="h-5 w-5" />}
          tonalidade="critico"
          descricao="Quantidade zerada"
        />
        <CartaoIndicador
          titulo="Total de entradas"
          valor={numero(resumo?.totalEntradas ?? 0)}
          icone={<TrendingUp className="h-5 w-5" />}
          tonalidade="positivo"
          descricao={`${numero(resumo?.entradas24h ?? 0)} na últimas 24h`}
        />
        <CartaoIndicador
          titulo="Total de saídas"
          valor={numero(resumo?.totalSaidas ?? 0)}
          icone={<TrendingDown className="h-5 w-5" />}
          tonalidade="critico"
          descricao={`${numero(resumo?.saidas24h ?? 0)} nas últimas 24h`}
        />
      </div>

      {/* ---------- gráficos ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 mb-5">
        <CartaoGrafico
          titulo="Histórico de entradas e saídas"
          descricao={`Movimentações por dia nos últimos ${periodo} dias`}
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosFluxo} margin={{ top: 5, right: 10, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => numero(Number(v))} labelStyle={{ fontWeight: 600 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="entradas"
                  name="Entradas"
                  stroke="#059669"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="saidas"
                  name="Saídas"
                  stroke="#e11d48"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>

        <CartaoGrafico
          titulo="Evolução das quantidades em estoque"
          descricao="Saldo total estimado ao fim de cada dia"
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosFluxo} margin={{ top: 5, right: 10, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => `${numero(Number(v))} un`} labelStyle={{ fontWeight: 600 }} />
                <Area
                  type="monotone"
                  dataKey="saldoEstoque"
                  name="Saldo em estoque"
                  stroke="#0d9488"
                  strokeWidth={2.2}
                  fill="url(#gradSaldo)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>

        <CartaoGrafico
          titulo="Distribuição por categoria"
          descricao="Unidades em estoque por categoria"
        >
          <div className="h-[280px]">
            {(series?.porCategoria.filter((c) => c.unidades > 0).length ?? 0) === 0 ? (
              <EstadoVazio mensagem="Nenhuma unidade em estoque no período" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={series?.porCategoria.filter((c) => c.unidades > 0)}
                    dataKey="unidades"
                    nameKey="categoria"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {(series?.porCategoria.filter((c) => c.unidades > 0) ?? []).map((_, i) => (
                      <Cell key={i} fill={CORES_CATEGORIA[i % CORES_CATEGORIA.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, nome) => [`${numero(Number(v))} un`, nome]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CartaoGrafico>

        <CartaoGrafico
          titulo="Produtos com maior movimentação"
          descricao={`Entradas + saídas nos últimos ${periodo} dias`}
        >
          <div className="h-[280px]">
            {(resumo?.produtosMaisMovimentados.length ?? 0) === 0 ? (
              <EstadoVazio mensagem="Sem movimentações no período" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={resumo?.produtosMaisMovimentados}
                  layout="vertical"
                  margin={{ top: 5, right: 20, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="produto"
                    width={130}
                    tick={{ fontSize: 10.5 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip formatter={(v) => `${numero(Number(v))} un`} labelStyle={{ fontWeight: 600 }} />
                  <Bar dataKey="total" name="Unidades movimentadas" fill="#059669" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CartaoGrafico>
      </div>

      {/* ---------- tabelas ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <Card className="shadow-sm py-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Movimentações recentes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos registros do histórico</p>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => aoNavegar('historico')}>
                Ver histórico <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {(resumo?.movimentacoesRecentes.length ?? 0) === 0 ? (
              <EstadoVazio mensagem="Nenhuma movimentação registrada" />
            ) : (
              <ul className="divide-y">
                {(resumo?.movimentacoesRecentes ?? []).map((m) => (
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

        <Card className="shadow-sm py-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Top produtos movimentados</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Ranking dos últimos {periodo} dias</p>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => aoNavegar('relatorios')}>
                Relatórios
              </Button>
            </div>
            {(resumo?.produtosMaisMovimentados.length ?? 0) === 0 ? (
              <EstadoVazio mensagem="Sem movimentações no período" />
            ) : (
              <ul className="space-y-3">
                {(resumo?.produtosMaisMovimentados ?? []).map((p, i) => {
                  const maximo = resumo?.produtosMaisMovimentados[0]?.total || 1
                  return (
                    <li key={p.id}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className="text-sm text-slate-800 truncate">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 mr-2">
                            {i + 1}
                          </span>
                          {p.produto}
                        </p>
                        <span className="text-sm font-bold text-slate-900 shrink-0">{numero(p.total)} un</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="gradiente-marca h-full rounded-full"
                          style={{ width: `${Math.max(4, (p.total / maximo) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {numero(p.entradas)} entradas · {numero(p.saidas)} saídas
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
