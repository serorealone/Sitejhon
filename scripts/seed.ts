/**
 * EstoquePro — Seed de dados demonstrativos
 * Cria: 2 usuários (admin/operador), 6 categorias, 24 produtos
 * e ~60 dias de histórico de movimentações com saldos consistentes.
 *
 * Uso: bun run scripts/seed.ts [--force]
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// RNG determinístico para seed reprodutível
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261126)
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

const CATEGORIAS = [
  { nome: 'Bebidas', descricao: 'Águas, sucos, refrigerantes, café e chás' },
  { nome: 'Alimentos', descricao: 'Alimentos não perecíveis, snacks e panificação' },
  { nome: 'Higiene e Limpeza', descricao: 'Produtos de limpeza doméstica e higiene pessoal' },
  { nome: 'Papelaria', descricao: 'Material de escritório e escolar' },
  { nome: 'Eletrônicos', descricao: 'Acessórios e periféricos de informática' },
  { nome: 'Ferramentas', descricao: 'Ferramentas manuais e materiais de manutenção' },
]

type ProdutoSeed = {
  nome: string
  descricao: string
  sku: string
  cat: string
  custo: number
  venda: number
  minimo: number
  inicial: number
}

const PRODUTOS: ProdutoSeed[] = [
  { nome: 'Água Mineral 500ml (fardo c/ 12)', descricao: 'Água natural sem gás, embalagem pet retornável', sku: 'BEB-0001', cat: 'Bebidas', custo: 14.4, venda: 21.9, minimo: 12, inicial: 60 },
  { nome: 'Refrigerante Cola 2L', descricao: 'Refrigerante sabor cola garrafa 2 litros', sku: 'BEB-0002', cat: 'Bebidas', custo: 5.2, venda: 8.9, minimo: 10, inicial: 30 },
  { nome: 'Suco de Uva Integral 1L', descricao: 'Suco integral sem adição de açúcar', sku: 'BEB-0003', cat: 'Bebidas', custo: 9.8, venda: 15.5, minimo: 6, inicial: 18 },
  { nome: 'Café Torrado e Moído 500g', descricao: 'Blend torrado médio, vacuum pack', sku: 'BEB-0004', cat: 'Bebidas', custo: 12.3, venda: 19.9, minimo: 8, inicial: 24 },
  { nome: 'Chá Verde Caixa 20 saquinhos', descricao: 'Chá verde folha em saquinhos', sku: 'BEB-0005', cat: 'Bebidas', custo: 4.1, venda: 7.5, minimo: 8, inicial: 20 },
  { nome: 'Biscoito Recheado 140g', descricao: 'Biscoito recheado chocolate ao leite', sku: 'ALI-0001', cat: 'Alimentos', custo: 2.15, venda: 3.99, minimo: 20, inicial: 80 },
  { nome: 'Macarrão Espaguete 500g', descricao: 'Massa de sêmola de trigo duro', sku: 'ALI-0002', cat: 'Alimentos', custo: 3.2, venda: 5.49, minimo: 15, inicial: 50 },
  { nome: 'Arroz Branco Tipo 1 — 5kg', descricao: 'Arroz branco polido tipo 1', sku: 'ALI-0003', cat: 'Alimentos', custo: 22.5, venda: 29.9, minimo: 10, inicial: 35 },
  { nome: 'Óleo de Soja 900ml', descricao: 'Óleo de soja refinado', sku: 'ALI-0004', cat: 'Alimentos', custo: 5.8, venda: 8.49, minimo: 12, inicial: 28 },
  { nome: 'Achocolatado em Pó 400g', descricao: 'Pó sabor chocolate fortificado', sku: 'ALI-0005', cat: 'Alimentos', custo: 7.9, venda: 12.9, minimo: 6, inicial: 16 },
  { nome: 'Sabão em Pó 1kg', descricao: 'Detergente em pó para roupas', sku: 'HIG-0001', cat: 'Higiene e Limpeza', custo: 8.75, venda: 14.9, minimo: 10, inicial: 26 },
  { nome: 'Detergente Neutro 500ml', descricao: 'Detergente líquido biodegradável', sku: 'HIG-0002', cat: 'Higiene e Limpeza', custo: 1.85, venda: 3.49, minimo: 18, inicial: 45 },
  { nome: 'Álcool Isopropílico 250ml', descricao: 'Limpeza de contatos eletrônicos', sku: 'HIG-0003', cat: 'Higiene e Limpeza', custo: 6.2, venda: 10.9, minimo: 5, inicial: 12 },
  { nome: 'Papel Toalha Rolo 2 un', descricao: 'Rolo duplo folha mércurio', sku: 'HIG-0004', cat: 'Higiene e Limpeza', custo: 4.5, venda: 7.99, minimo: 12, inicial: 30 },
  { nome: 'Desodorante Aerossol 150ml', descricao: 'Desodorante corporal sem perfume', sku: 'HIG-0005', cat: 'Higiene e Limpeza', custo: 9.3, venda: 15.9, minimo: 8, inicial: 14 },
  { nome: 'Caderno Universitário 200 folhas', descricao: 'Caderno pautado capa dura', sku: 'PAP-0001', cat: 'Papelaria', custo: 11.0, venda: 18.9, minimo: 8, inicial: 22 },
  { nome: 'Caneta Esferográfica Azul (cx 50)', descricao: 'Caixa com 50 unidades ponta 1.0mm', sku: 'PAP-0002', cat: 'Papelaria', custo: 18.5, venda: 29.9, minimo: 6, inicial: 15 },
  { nome: 'Lápis Preto Nº 2 (cx 24)', descricao: 'Caixa com 24 lápis grafite', sku: 'PAP-0003', cat: 'Papelaria', custo: 9.9, venda: 16.5, minimo: 5, inicial: 12 },
  { nome: 'Resma Papel A4 75g', descricao: 'Resma com 500 folhas', sku: 'PAP-0004', cat: 'Papelaria', custo: 21.0, venda: 32.9, minimo: 10, inicial: 28 },
  { nome: 'Post-it 76x76mm Bloco 12', descricao: 'Bloco adesivo amarelo', sku: 'PAP-0005', cat: 'Papelaria', custo: 15.2, venda: 24.9, minimo: 4, inicial: 10 },
  { nome: 'Mouse Óptico USB 1200dpi', descricao: 'Mouse com fio 3 botões', sku: 'ELE-0001', cat: 'Eletrônicos', custo: 14.5, venda: 24.9, minimo: 6, inicial: 14 },
  { nome: 'Cabo HDMI 1.8m', descricao: 'Cabo HDMI 2.0 blindado', sku: 'ELE-0002', cat: 'Eletrônicos', custo: 12.0, venda: 22.5, minimo: 8, inicial: 18 },
  { nome: 'Pen Drive 64GB USB 3.0', descricao: 'Memória flash 64 gigabytes', sku: 'ELE-0003', cat: 'Eletrônicos', custo: 25.0, venda: 42.9, minimo: 5, inicial: 12 },
  { nome: 'Kit Chaves de Fenda 6 peças', descricao: 'Chaves isoladas 1000V', sku: 'FER-0001', cat: 'Ferramentas', custo: 28.0, venda: 45.9, minimo: 4, inicial: 9 },
]

const MOTIVOS_SAIDA = ['Venda balcão', 'Venda online', 'Uso interno', 'Perda/Avaria', 'Ajuste de inventário']
const OBS_ENTRADA = ['Compra fornecedor', 'Reposição de prateleira', 'Compra emergencial', 'Devolução de cliente', '']
const OBS_SAIDA = ['Cliente persona física', 'Pedido delivery', 'Consumo do escritório', 'Item com embalagem danificada', '']

async function main() {
  const force = process.argv.includes('--force')
  const existentes = await prisma.usuario.count()
  if (existentes > 0 && !force) {
    console.log('Banco já possui dados — seed ignorado (use --force para reinserir).')
    return
  }
  if (force) {
    await prisma.movimentacao.deleteMany()
    await prisma.produto.deleteMany()
    await prisma.categoria.deleteMany()
    await prisma.usuario.deleteMany()
  }

  // ---------- usuários ----------
  const adminHash = await bcrypt.hash('Admin@123', 10)
  const operadorHash = await bcrypt.hash('Operador@123', 10)
  const admin = await prisma.usuario.create({
    data: { nome: 'Ana Souza', email: 'admin@estoquepro.com', senhaHash: adminHash, papel: 'ADMIN' },
  })
  const operador = await prisma.usuario.create({
    data: { nome: 'Carlos Lima', email: 'operador@estoquepro.com', senhaHash: operadorHash, papel: 'OPERADOR' },
  })

  // ---------- categorias ----------
  const catMap = new Map<string, number>()
  for (const c of CATEGORIAS) {
    const criada = await prisma.categoria.create({ data: c })
    catMap.set(c.nome, criada.id)
  }

  // ---------- produtos ----------
  const agora = Date.now()
  const DIA = 24 * 60 * 60 * 1000
  const produtosCriados: Array<ProdutoSeed & { id: number }> = []
  for (const p of PRODUTOS) {
    const criado = await prisma.produto.create({
      data: {
        nome: p.nome,
        descricao: p.descricao,
        sku: p.sku,
        categoriaId: catMap.get(p.cat)!,
        quantidade: 0, // será ajustado pelo histórico
        estoqueMinimo: p.minimo,
        precoCusto: p.custo,
        precoVenda: p.venda,
        criadoEm: new Date(agora - 75 * DIA),
      },
    })
    produtosCriados.push({ ...p, id: criado.id })
  }

  // ---------- movimentações (75 dias, saldos consistentes) ----------
  // Cada produto: entrada inicial grande, depois fluxo de entradas/saídas.
  // Garantimos: saldo nunca negativo; quantidade final = saldo final.
  let totalMovs = 0
  for (const p of produtosCriados) {
    let saldo = 0
    // entrada inicial em dia -70
    const inicial = p.inicial + randInt(10, 40)
    await prisma.movimentacao.create({
      data: {
        produtoId: p.id,
        tipo: 'ENTRADA',
        quantidade: inicial,
        observacao: 'Compra fornecedor — carga inicial',
        saldoResultante: inicial,
        usuarioId: admin.id,
        criadoEm: new Date(agora - 70 * DIA - randInt(0, 6) * 3600 * 1000),
      },
    })
    saldo = inicial
    totalMovs++

    // fluxo diário entre -65 e -1
    for (let d = 65; d >= 1; d--) {
      if (rand() > 0.42) continue // nem todo dia tem movimentação
      const qtd = randInt(1, Math.max(3, Math.round(p.inicial / 6)))
      // decide tipo: favorece saída; se saldo baixo, força entrada
      const saldoCritico = saldo <= p.minimo
      let tipo: 'ENTRADA' | 'SAIDA'
      if (saldoCritico || rand() < 0.35) tipo = 'ENTRADA'
      else tipo = 'SAIDA'
      if (tipo === 'SAIDA' && qtd > saldo) continue
      const usuarioId = rand() < 0.5 ? admin.id : operador.id
      const criadoEm = new Date(agora - d * DIA + randInt(8, 19) * 3600 * 1000 + randInt(0, 59) * 60 * 1000)
      saldo = tipo === 'ENTRADA' ? saldo + qtd : saldo - qtd
      await prisma.movimentacao.create({
        data: {
          produtoId: p.id,
          tipo,
          quantidade: qtd,
          motivo: tipo === 'SAIDA' ? pick(MOTIVOS_SAIDA) : null,
          observacao: tipo === 'ENTRADA' ? pick(OBS_ENTRADA) : pick(OBS_SAIDA),
          saldoResultante: saldo,
          usuarioId,
          criadoEm,
        },
      })
      totalMovs++
    }

    // molda situações finais para demonstrar alertas:
    // i%7==5 -> sem estoque (0); i%5==3 (e não sem estoque) -> estoque baixo
    const idx = produtosCriados.indexOf(p)
    const semEstoque = idx % 7 === 5
    const baixo = !semEstoque && idx % 5 === 3
    let alvo: number | null = null
    if (semEstoque) alvo = 0
    else if (baixo) alvo = Math.max(1, randInt(1, p.minimo))
    if (alvo !== null && saldo > alvo) {
      const qtdSaida = saldo - alvo
      saldo = alvo
      await prisma.movimentacao.create({
        data: {
          produtoId: p.id,
          tipo: 'SAIDA',
          quantidade: qtdSaida,
          motivo: semEstoque ? 'Ajuste de inventário' : 'Venda balcão',
          observacao: 'Ajuste final do inventário',
          saldoResultante: saldo,
          usuarioId: admin.id,
          criadoEm: new Date(agora - 1 * DIA + 11 * 3600 * 1000),
        },
      })
      totalMovs++
    }

    // ajusta quantidade final do produto ao saldo real do histórico
    await prisma.produto.update({ where: { id: p.id }, data: { quantidade: saldo } })
  }

  // ---------- resumo ----------
  const cats = await prisma.categoria.count()
  const prods = await prisma.produto.count()
  const movs = await prisma.movimentacao.count()
  const baixo = await prisma.produto.count({
    where: { ativo: true, quantidade: { gt: 0, lte: prisma.produto.fields.estoqueMinimo } },
  }).catch(() => 'n/a')
  console.log('Seed concluído:')
  console.log(`  usuários: 2 (admin@estoquepro.com / operador@estoquepro.com)`)
  console.log(`  categorias: ${cats}`)
  console.log(`  produtos: ${prods}`)
  console.log(`  movimentações: ${movs} (esperado: ${totalMovs})`)
  console.log(`  produtos em estoque baixo (aprox): ${baixo}`)
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
