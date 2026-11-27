import { categoriasController } from '@/server/controllers/categorias.controller'

export const dynamic = 'force-dynamic'

export const GET = categoriasController.listar
export const POST = categoriasController.criar
