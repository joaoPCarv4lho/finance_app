const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatCurrency(value) {
  const n = Number(value ?? 0)
  return brl.format(Number.isFinite(n) ? n : 0)
}

export function formatDate(value) {
  if (!value) return ''
  // value is an ISO date string (YYYY-MM-DD) — parse without timezone shift.
  const [y, m, d] = String(value).slice(0, 10).split('-')
  if (!y) return value
  return `${d}/${m}/${y}`
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const TYPE_LABELS = {
  INCOME: 'Entrada',
  EXPENSE: 'Saída',
  INVESTMENT: 'Investimento',
}
