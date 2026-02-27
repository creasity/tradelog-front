'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { EquityPoint } from '@/lib/api'
import { formatDate, formatPnL } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

interface EquityCurveProps {
  data: EquityPoint[]
  loading?: boolean
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as EquityPoint
  const isPositive = d.cumulative_pnl >= 0

  return (
    <div className="card px-4 py-3 shadow-xl min-w-[180px]">
      <p className="text-xs font-mono text-gray-400 mb-2">{formatDate(label, 'long')}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-xs text-gray-400">Cumul P&L</span>
          <span className={`text-xs font-mono font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {formatPnL(d.cumulative_pnl)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs text-gray-400">Journée</span>
          <span className={`text-xs font-mono ${d.daily_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {formatPnL(d.daily_pnl)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-xs text-gray-400">Trades</span>
          <span className="text-xs font-mono text-gray-300">{d.trades_count}</span>
        </div>
      </div>
    </div>
  )
}

export default function EquityCurve({ data, loading }: EquityCurveProps) {
  const { isDark } = useTheme()

  if (loading) {
    return <div className="skeleton h-64 rounded-xl" />
  }

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm font-mono">
        Aucune donnée — ferme ton premier trade pour voir la courbe
      </div>
    )
  }

  const isPositive = data[data.length - 1]?.cumulative_pnl >= 0
  const color = isPositive ? '#00d17a' : '#ff3b5c'
  const gridColor = isDark ? '#1e2028' : '#e5e5e0'
  const textColor = isDark ? '#6b7280' : '#9ca3af'

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => formatDate(v)}
          tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: textColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`}
          tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: textColor }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke={gridColor} strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="cumulative_pnl"
          stroke={color}
          strokeWidth={2}
          fill="url(#equityGrad)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
