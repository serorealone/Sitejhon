/**
 * EstoquePro — Serviço de categorias
 * Regras de negócio e consultas SQL (parametrizadas).
 */
import { db } from '@/lib/db'
import { ApiError, Paginacao, metaPaginacao } from '../lib/http'
import { CategoriaInput } from '../validators/schemas'

const ORDENS: Record<string, string> = {
  nome: 'c.nome',
  produtos: 'produtos_vinculados',
  criado_em: 'c.criado_em',
}

export interface CategoriaComContagem {
  id: number
  nome: string
  descricao: string | null
  criadoEm: string
  produtosVinculados: number
}

export const categoriasService = {
  /** Lista paginada com pesquisa e contagem de produtos vinculados. */
  async listar(params: { busca?: string; ordem?: string; dir?: string } & Paginacao) {
    const { busca, page, limit, offset } = params
    const ordem = ORDENS[params.ordem ?? 'nome'] ?? ORDENS.nome
    const dir = (params.dir ?? 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    const condicoes: string[] = []
    const valores: (string | number)[] = []
    if (busca && busca.trim()) {
      condicoes.push('(c.nome LIKE ? OR c.descricao LIKE ?)')
      const b = `%${busca.trim()}%`
      valores.push(b, b)
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''

    const totalRows = await db.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*) AS total FROM categorias c ${where}`,
      ...valores
    )
    const total = Number(totalRows[0]?.total ?? 0)

    const dados = await db.$queryRawUnsafe<CategoriaComContagem[]>(
      `SELECT c.id, c.nome, c.descricao, c.criado_em AS criadoEm,
              COUNT(p.id) AS produtosVinculados
       FROM categorias c
       LEFT JOIN produtos p ON p.categoria_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY ${ordem} ${dir}
       LIMIT ? OFFSET ?`,
      ...valores, limit, offset
    )

    return { dados: dados.map(serialize), meta: metaPaginacao({ page, limit, offset }, total) }
  },

  /** Lista compacta para seletores/filtros. */
  async listarResumo() {
    const dados = await db.$queryRawUnsafe<{ id: number; nome: string }[]>(
      `SELECT id, nome FROM categorias ORDER BY nome ASC`
    )
    return dados
  },

  async buscarPorId(id: number) {
    const rows = await db.$queryRawUnsafe<CategoriaComContagem[]>(
      `SELECT c.id, c.nome, c.descricao, c.criado_em AS criadoEm,
              COUNT(p.id) AS produtosVinculados
       FROM categorias c
       LEFT JOIN produtos p ON p.categoria_id = c.id
       WHERE c.id = ?
       GROUP BY c.id`,
      id
    )
    if (!rows[0]) throw new ApiError(404, 'Categoria não encontrada.', 'NAO_ENCONTRADO')
    return serialize(rows[0])
  },

  async criar(input: CategoriaInput) {
    const nome = input.nome
    const descricao = input.descricao ? input.descricao : null

    await this.validarNomeUnico(nome)

    const criada = await db.categoria.create({ data: { nome, descricao } })
    return criada
  },

  /** Nome único case-insensitive (alinhado ao UNIQUE COLLATE NOCASE do DDL). */
  async validarNomeUnico(nome: string, idIgnorar?: number) {
    const rows = await db.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM categorias WHERE nome = ? COLLATE NOCASE ${idIgnorar ? 'AND id != ?' : ''} LIMIT 1`,
      ...(idIgnorar ? [nome, idIgnorar] : [nome])
    )
    if (rows[0]) throw new ApiError(409, `Já existe uma categoria chamada "${nome}".`, 'DUPLICADO')
  },

  async atualizar(id: number, input: Partial<CategoriaInput>) {
    await this.buscarPorId(id)
    if (input.nome) {
      await this.validarNomeUnico(input.nome, id)
    }
    const atualizada = await db.categoria.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao || null } : {}),
      },
    })
    return atualizada
  },

  /**
   * Exclusão permitida apenas quando NENHUM produto está vinculado
   * (mesmo arquivado). O banco também impede via FK RESTRICT.
   */
  async excluir(id: number) {
    await this.buscarPorId(id)
    const vinculados = await db.produto.count({ where: { categoriaId: id } })
    if (vinculados > 0) {
      throw new ApiError(
        409,
        `Categoria não pode ser excluída: existem ${vinculados} produto(s) vinculado(s).`,
        'CATEGORIA_COM_PRODUTOS',
        { vinculados }
      )
    }
    await db.categoria.delete({ where: { id } })
  },
}

function serialize(r: CategoriaComContagem) {
  return { ...r, produtosVinculados: Number(r.produtosVinculados) }
}
