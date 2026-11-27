/**
 * EstoquePro — Logotipo da marca
 * Ícone: cubo/caixas sobre quadrado com gradiente esmeralda.
 */
import { Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  variante?: 'completo' | 'icone'
  claro?: boolean
  className?: string
  tamanhoIcone?: number
}

export function Logo({ variante = 'completo', claro = false, className, tamanhoIcone = 22 }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      <div
        className="gradiente-marca flex shrink-0 items-center justify-center rounded-xl shadow-sm"
        style={{ width: Math.max(34, tamanhoIcone + 14), height: Math.max(34, tamanhoIcone + 14) }}
        aria-hidden="true"
      >
        <Boxes size={tamanhoIcone} className="text-white" strokeWidth={2.2} />
      </div>
      {variante === 'completo' && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              'text-lg font-bold tracking-tight',
              claro ? 'text-white' : 'text-slate-900'
            )}
          >
            Estoque<span className="text-emerald-500">Pro</span>
          </span>
          <span
            className={cn(
              'text-[10px] font-medium uppercase tracking-widest',
              claro ? 'text-slate-400' : 'text-slate-400'
            )}
          >
            Gestão de estoque
          </span>
        </div>
      )}
    </div>
  )
}
