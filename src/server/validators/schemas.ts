/**
 * EstoquePro — Esquemas de validação (Zod) da camada de API.
 * Validações aplicadas NO SERVIDOR; o front-end replica as regras
 * básicas para feedback imediato ao usuário.
 */
import { z } from 'zod'

// ---------------- autenticação ----------------
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(160),
  senha: z.string().min(1, 'Informe a senha').max(100),
})

// ---------------- categorias ----------------
export const categoriaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  descricao: z.string().trim().max(300, 'Descrição deve ter no máximo 300 caracteres').optional().nullable().or(z.literal('')),
})

// ---------------- produtos ----------------
export const produtoSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(150, 'Nome deve ter no máximo 150 caracteres'),
  descricao: z.string().trim().max(500, 'Descrição deve ter no máximo 500 caracteres').optional().nullable().or(z.literal('')),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9\-_]{1,23}$/, 'SKU deve ter 2 a 24 caracteres alfanuméricos (pode usar - e _)'),
  categoriaId: z.number({ message: 'Informe a categoria' }).int('Categoria inválida').positive('Informe a categoria'),
  estoqueMinimo: z.number({ message: 'Estoque mínimo inválido' }).int('Estoque mínimo deve ser inteiro').min(0, 'Estoque mínimo não pode ser negativo').max(1_000_000),
  precoCusto: z.number({ message: 'Preço de custo inválido' }).min(0, 'Preço de custo não pode ser negativo').max(999_999_999),
  precoVenda: z.number({ message: 'Preço de venda inválido' }).min(0, 'Preço de venda não pode ser negativo').max(999_999_999),
  quantidadeInicial: z.number().int('Quantidade inicial deve ser inteira').min(0, 'Quantidade inicial não pode ser negativa').max(1_000_000).optional().default(0),
})

/** Atualização: quantidade NÃO é editável diretamente (apenas por movimentações). */
export const produtoUpdateSchema = produtoSchema.omit({ quantidadeInicial: true }).partial()

// ---------------- movimentações ----------------
export const MOTIVOS_SAIDA = ['Venda', 'Uso interno', 'Perda/Avaria', 'Ajuste de inventário', 'Outro'] as const

export const movimentacaoSchema = z
  .object({
    produtoId: z.number({ message: 'Informe o produto' }).int('Produto inválido').positive('Informe o produto'),
    tipo: z.enum(['ENTRADA', 'SAIDA']),
    quantidade: z
      .number({ message: 'Quantidade inválida' })
      .int('Quantidade deve ser um número inteiro')
      .positive('Quantidade deve ser maior que zero')
      .max(1_000_000, 'Quantidade acima do limite permitido'),
    motivo: z.string().trim().max(120, 'Motivo deve ter no máximo 120 caracteres').optional().nullable().or(z.literal('')),
    observacao: z.string().trim().max(500, 'Observação deve ter no máximo 500 caracteres').optional().nullable().or(z.literal('')),
  })
  .refine((d) => d.tipo !== 'SAIDA' || (d.motivo && d.motivo.length >= 2), {
    message: 'Informe o motivo da saída',
    path: ['motivo'],
  })

// ---------------- usuários ----------------
export const PAPEIS = ['ADMIN', 'OPERADOR'] as const

export const usuarioSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(160),
  senha: z
    .string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .max(100)
    .regex(/[A-Za-z]/, 'Senha deve conter letras')
    .regex(/[0-9]/, 'Senha deve conter números'),
  papel: z.enum(PAPEIS),
})

export const usuarioUpdateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(120).optional(),
  papel: z.enum(PAPEIS).optional(),
  ativo: z.boolean().optional(),
  senha: z
    .string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .max(100)
    .regex(/[A-Za-z]/, 'Senha deve conter letras')
    .regex(/[0-9]/, 'Senha deve conter números')
    .optional(),
})

/** Tipos inferidos */
export type LoginInput = z.infer<typeof loginSchema>
export type CategoriaInput = z.infer<typeof categoriaSchema>
export type ProdutoInput = z.infer<typeof produtoSchema>
export type ProdutoUpdateInput = z.infer<typeof produtoUpdateSchema>
export type MovimentacaoInput = z.infer<typeof movimentacaoSchema>
export type UsuarioInput = z.infer<typeof usuarioSchema>
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>
