import { usuariosController } from '@/server/controllers/usuarios.controller'

export const dynamic = 'force-dynamic'

export const GET = usuariosController.listar
export const POST = usuariosController.criar
