import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatPnL(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined) return '—'
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatR(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}R`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}j`
}

export function formatDate(date: string | null | undefined, style: 'short' | 'long' | 'time' = 'short'): string {
  if (!date) return '—'
  const d = new Date(date)
  if (style === 'time') return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (style === 'long') return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function getPnLColor(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'text-gray-400'
  if (value > 0) return 'text-profit'
  if (value < 0) return 'text-loss'
  return 'text-gray-400'
}

export function getPnLBg(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (value > 0) return 'bg-profit/10 text-profit'
  if (value < 0) return 'bg-loss/10 text-loss'
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
