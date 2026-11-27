import { produtosController } from '@/server/controllers/produtos.controller'

export const dynamic = 'force-dynamic'

export const GET = produtosController.listar
export const POST = produtosController.criar
