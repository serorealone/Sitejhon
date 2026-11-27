import { usuariosController } from '@/server/controllers/usuarios.controller'

export const dynamic = 'force-dynamic'

export const PATCH = usuariosController.atualizar
export const DELETE = usuariosController.excluir
