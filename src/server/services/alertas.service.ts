/**
 * EstoquePro — Serviço de alertas de estoque
 * Situações: NORMAL | BAIXO (qtd <= mínimo configurado, qtd > 0) | SEM_ESTOQUE (qtd = 0)
 */
import { db } from '@/lib/db'

export const alertasService = {
  async listar() {
    const dados = await db.$queryRawUnsafe<any[]>(`
      SELECT p.id, p.nome, p.sku, c.nome AS categoriaNome, c.id AS categoriaId,
             p.quantidade, p.estoque_minimo AS estoqueMinimo,
             CASE
               WHEN p.quantidade = 0 THEN 'SEM_ESTOQUE'
               WHEN p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo THEN 'BAIXO'
               ELSE 'NORMAL' END AS situacao
      FROM produtos p
      JOIN categorias c ON c.id = p.categoria_id
      WHERE p.ativo = 1
        AND (p.quantidade = 0 OR (p.estoque_minimo > 0 AND p.quantidade <= p.estoque_minimo))
      ORDER BY CASE WHEN p.quantidade = 0 THEN 0 ELSE 1 END ASC, p.quantidade ASC, p.nome ASC`)

    const produtos = dados.map((r) => ({
      id: Number(r.id),
      nome: r.nome,
      sku: r.sku,
      categoriaId: Number(r.categoriaId),
      categoriaNome: r.categoriaNome,
      quantidade: Number(r.quantidade),
      estoqueMinimo: Number(r.estoqueMinimo),
      situacao: r.situacao,
    }))

    return {
      resumo: {
        semEstoque: produtos.filter((p) => p.situacao === 'SEM_ESTOQUE').length,
        estoqueBaixo: produtos.filter((p) => p.situacao === 'BAIXO').length,
        total: produtos.length,
      },
      produtos,
    }
  },
}
