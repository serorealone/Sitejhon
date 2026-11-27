import { produtosController } from '@/server/controllers/produtos.controller'

export const dynamic = 'force-dynamic'

export const GET = produtosController.buscarPorId
export const PATCH = produtosController.atualizar
export const DELETE = produtosController.excluir
