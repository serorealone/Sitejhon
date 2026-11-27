import { categoriasController } from '@/server/controllers/categorias.controller'

export const dynamic = 'force-dynamic'

export const GET = categoriasController.buscarPorId
export const PATCH = categoriasController.atualizar
export const DELETE = categoriasController.excluir
