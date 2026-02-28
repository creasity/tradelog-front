import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Converts any API value (string | number | null) safely to number */
export function toNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  return Number(v) || 0
}

/** Safe toFixed — never crashes on strings from PostgreSQL */
export function fixed(v: any, decimals = 2): string {
  return toNum(v).toFixed(decimals)
}

export function formatPnL(value: number | string | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (isNaN(n)) return '—'
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n))
  return n >= 0 ? `+${formatted}` : `-${formatted}`
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export function formatR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}R`
}

export function formatDuration(seconds: number | string | null | undefined): string {
  if (!seconds) return '—'
  const s = Number(seconds)
  if (isNaN(s) || s === 0) return '—'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}j`
}

export function formatDate(date: string | null | undefined, style: 'short' | 'long' | 'time' = 'short'): string {
  if (!date) return '—'
  const d = new Date(date)
  if (style === 'time') return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (style === 'long') return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function getPnLColor(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'text-gray-400'
  const n = Number(value)
  if (n > 0) return 'text-profit'
  if (n < 0) return 'text-loss'
  return 'text-gray-400'
}

export function getPnLBg(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  if (n > 0) return 'bg-profit/10 text-profit'
  if (n < 0) return 'bg-loss/10 text-loss'
  return 'bg-gray-500/10 text-gray-400'
}

export function getSideColor(side: 'long' | 'short'): string {
  return side === 'long' ? 'text-profit' : 'text-loss'
}

export function getSideBg(side: 'long' | 'short'): string {
  return side === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
}

export function truncate(str: string, length = 30): string {
  if (!str) return ''
  return str.length > length ? str.slice(0, length) + '…' : str
}