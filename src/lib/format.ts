/**
 * EstoquePro — Formatação de valores (pt-BR)
 */
export function moeda(valor: number | string | null | undefined): string {
  const n = Number(valor ?? 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function numero(valor: number | string | null | undefined): string {
  const n = Number(valor ?? 0)
  return n.toLocaleString('pt-BR')
}

function paraData(valor: string | number | Date | null | undefined): Date | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  if (typeof valor === 'number') {
    // epoch em milissegundos (padrão de armazenamento do banco)
    const dNum = new Date(valor < 1e12 ? valor * 1000 : valor)
    return Number.isNaN(dNum.getTime()) ? null : dNum
  }
  if (/^\d+$/.test(String(valor))) {
    const n = Number(valor)
    const dNum = new Date(n < 1e12 ? n * 1000 : n)
    return Number.isNaN(dNum.getTime()) ? null : dNum
  }
  const d = new Date(String(valor).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

/** "2026-11-26 07:43:35" | ISO | epoch → "26/11/2026" */
export function data(valor: string | number | Date | null | undefined): string {
  const d = paraData(valor)
  return d ? d.toLocaleDateString('pt-BR') : valor ? String(valor) : '—'
}

/** ISO | epoch → "26/11/2026 07:43" */
export function dataHora(valor: string | number | Date | null | undefined): string {
  const d = paraData(valor)
  if (!d) return valor ? String(valor) : '—'
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** ISO | epoch → { data: "26/11/2026", hora: "07:43:35" } */
export function separarDataHora(valor: string | number | Date | null | undefined): { data: string; hora: string } {
  const d = paraData(valor)
  if (!d) return { data: valor ? String(valor) : '—', hora: '' }
  return {
    data: d.toLocaleDateString('pt-BR'),
    hora: d.toLocaleTimeString('pt-BR', { hour12: false }),
  }
}

export type Situacao = 'NORMAL' | 'BAIXO' | 'SEM_ESTOQUE'

export const rotuloSituacao: Record<Situacao, string> = {
  NORMAL: 'Normal',
  BAIXO: 'Estoque baixo',
  SEM_ESTOQUE: 'Sem estoque',
}

export const dataISOHoje = (): string => new Date().toISOString().slice(0, 10)
