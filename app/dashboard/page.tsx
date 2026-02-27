'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import StatCard from '@/components/ui/StatCard'
import EquityCurve from '@/components/charts/EquityCurve'
import { analytics, accounts, trades, Analytics, EquityPoint, Account, Trade } from '@/lib/api'
import { formatPnL, formatPercent, formatDuration, formatDate, getPnLColor, getSideBg, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Clock, ChevronRight, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const PERIODS = [
  { label: '7J', value: '7d' },
  { label: '30J', value: '30d' },
  { label: '3M', value: '90d' },
  { label: '1AN', value: '1y' },
  { label: 'TOUT', value: 'all' },
]

export default function DashboardPage() {
  const [period, setPeriod] = useState('30d')
  const [overview, setOverview] = useState<Analytics | null>(null)
  const [curve, setCurve] = useState<EquityPoint[]>([])
  const [accountList, setAccountList] = useState<Account[]>([])
  const [recentTrades, setRecentTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [ov, curve, accs, tr] = await Promise.all([
        analytics.overview(period),
        analytics.equityCurve(),
        accounts.list(),
        trades.list({ limit: 5, status: 'closed', sort: 'entry_time', order: 'desc' }),
      ])
      setOverview(ov.overview)
      setCurve(curve.equity_curve)
      setAccountList(accs.accounts)
      setRecentTrades(tr.trades)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [period])

  const totalBalance = accountList.reduce((s, a) => s + (a.current_balance || a.initial_balance || 0), 0)
  const openTrades = accountList.reduce((s, a) => s + (a.open_trades || 0), 0)

  return (
    <AppLayout title="Dashboard" subtitle={`${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}>

      {/* Period selector + refresh */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg p-1">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-mono font-semibold uppercase tracking-wider transition-all',
                period === value
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => load(true)}
          className={cn('w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-light-hover dark:hover:bg-dark-hover transition-all', refreshing && 'animate-spin')}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="P&L Net"
          value={formatPnL(overview?.total_pnl)}
          color={overview?.total_pnl === undefined ? 'default' : overview.total_pnl >= 0 ? 'profit' : 'loss'}
          trend={overview?.total_pnl === undefined ? undefined : overview.total_pnl >= 0 ? 'up' : 'down'}
          subvalue={`${overview?.total_trades || 0} trades fermés`}
          loading={loading}
        />
        <StatCard
          label="Win Rate"
          value={overview ? `${overview.win_rate}%` : '—'}
          color={!overview ? 'default' : overview.win_rate >= 50 ? 'profit' : 'loss'}
          subvalue={overview ? `${overview.winning_trades}W / ${overview.losing_trades}L` : undefined}
          loading={loading}
        />
        <StatCard
          label="Profit Factor"
          value={overview?.profit_factor ? overview.profit_factor.toFixed(2) : '—'}
          color={!overview?.profit_factor ? 'default' : overview.profit_factor >= 1.5 ? 'profit' : overview.profit_factor >= 1 ? 'warn' : 'loss'}
          subvalue="Gains / Pertes brutes"
          loading={loading}
        />
        <StatCard
          label="R Moyen"
          value={overview?.avg_r ? `${Number(overview.avg_r) > 0 ? '+' : ''}${Number(overview.avg_r).toFixed(2)}R` : '—'}
          color={!overview?.avg_r ? 'default' : overview.avg_r >= 1 ? 'profit' : overview.avg_r > 0 ? 'warn' : 'loss'}
          subvalue="Ratio risque/récompense"
          loading={loading}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Meilleur Trade"
          value={formatPnL(overview?.best_trade)}
          color="profit"
          loading={loading}
        />
        <StatCard
          label="Pire Trade"
          value={formatPnL(overview?.worst_trade)}
          color="loss"
          loading={loading}
        />
        <StatCard
          label="Durée Moyenne"
          value={formatDuration(overview?.avg_duration_seconds)}
          loading={loading}
          mono
        />
        <StatCard
          label="Trades Ouverts"
          value={openTrades}
          color={openTrades > 0 ? 'accent' : 'default'}
          subvalue={`Solde total: ${totalBalance ? formatPnL(totalBalance) : '—'}`}
          loading={loading}
        />
      </div>

      {/* Equity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-base uppercase tracking-wider text-gray-900 dark:text-white">
              Courbe de Performance
            </h2>
            {curve.length > 0 && (
              <span className={cn(
                'text-sm font-mono font-semibold',
                curve[curve.length - 1]?.cumulative_pnl >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {formatPnL(curve[curve.length - 1]?.cumulative_pnl)}
              </span>
            )}
          </div>
          <EquityCurve data={curve} loading={loading} />
        </div>

        {/* Account breakdown */}
        <div className="card p-5">
          <h2 className="font-display font-700 text-base uppercase tracking-wider text-gray-900 dark:text-white mb-4">
            Comptes
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
            </div>
          ) : accountList.length === 0 ? (
            <div className="text-sm text-gray-400 font-mono text-center py-8">
              Aucun compte
              <Link href="/settings" className="block text-accent text-xs mt-2 hover:underline">Créer un compte →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {accountList.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-light-hover dark:bg-dark-hover">
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">{acc.name}</div>
                    <div className="text-xs text-gray-400 font-mono uppercase">{acc.broker} · {acc.currency}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-sm font-mono font-semibold', getPnLColor(acc.total_pnl))}>
                      {formatPnL(acc.total_pnl)}
                    </div>
                    <div className="text-xs text-gray-400">{acc.total_trades || 0} trades</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent trades */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-light-border dark:border-dark-border">
          <h2 className="font-display font-700 text-base uppercase tracking-wider text-gray-900 dark:text-white">
            Derniers Trades
          </h2>
          <Link href="/trades" className="text-xs font-mono text-accent hover:underline flex items-center gap-1">
            Voir tout <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : recentTrades.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm font-mono">
            Aucun trade fermé — <Link href="/trades/new" className="text-accent hover:underline">Ajouter un trade</Link>
          </div>
        ) : (
          <table className="tl-table">
            <thead>
              <tr>
                <th>Symbole</th>
                <th>Direction</th>
                <th>Entrée</th>
                <th>Date</th>
                <th>P&L Net</th>
                <th>R</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map(trade => (
                <tr key={trade.id} className="cursor-pointer" onClick={() => window.location.href = `/trades/${trade.id}`}>
                  <td>
                    <span className="font-mono font-semibold text-gray-900 dark:text-white text-sm">{trade.symbol}</span>
                  </td>
                  <td>
                    <span className={cn('badge', getSideBg(trade.side))}>
                      {trade.side.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-sm text-gray-500 dark:text-gray-400">{trade.entry_price}</span>
                  </td>
                  <td>
                    <span className="font-mono text-xs text-gray-400">{formatDate(trade.entry_time)}</span>
                  </td>
                  <td>
                    <span className={cn('font-mono font-semibold text-sm', getPnLColor(trade.net_pnl))}>
                      {formatPnL(trade.net_pnl)}
                    </span>
                  </td>
                  <td>
                    <span className={cn('font-mono text-sm', getPnLColor(trade.r_multiple))}>
                      {trade.r_multiple ? `${trade.r_multiple > 0 ? '+' : ''}${trade.r_multiple.toFixed(2)}R` : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  )
}
