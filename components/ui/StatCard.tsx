'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  subvalue?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: 'default' | 'profit' | 'loss' | 'accent' | 'warn'
  loading?: boolean
  className?: string
  mono?: boolean
}

const colorMap = {
  default:  'text-gray-900 dark:text-white',
  profit:   'text-profit',
  loss:     'text-loss',
  accent:   'text-accent',
  warn:     'text-warn',
}

const bgMap = {
  default:  '',
  profit:   'border-l-2 border-l-profit',
  loss:     'border-l-2 border-l-loss',
  accent:   'border-l-2 border-l-accent',
  warn:     'border-l-2 border-l-warn',
}

export default function StatCard({
  label, value, subvalue, trend, color = 'default', loading, className, mono = true
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  if (loading) {
    return (
      <div className={cn('stat-card', className)}>
        <div className="skeleton h-3 w-20 mb-3" />
        <div className="skeleton h-8 w-32" />
        {subvalue && <div className="skeleton h-3 w-16 mt-1" />}
      </div>
    )
  }

  return (
    <div className={cn('stat-card animate-fade-up', bgMap[color], className)}>
      <span className="tl-label">{label}</span>
      <div className="flex items-end gap-2 mt-1">
        <span className={cn(
          'text-lg sm:text-2xl font-semibold leading-none',
          mono ? 'font-mono' : 'font-display',
          colorMap[color]
        )}>
          {value}
        </span>
        {trend && (
          <TrendIcon
            size={14}
            className={cn(
              'mb-0.5 flex-shrink-0',
              trend === 'up' ? 'text-profit' : trend === 'down' ? 'text-loss' : 'text-gray-400'
            )}
          />
        )}
      </div>
      {subvalue && (
        <span className="text-xs text-gray-400 font-mono mt-0.5">{subvalue}</span>
      )}
    </div>
  )
}
