'use client'

import { useEffect, useState, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import StatCard from '@/components/ui/StatCard'
import EquityCurve from '@/components/charts/EquityCurve'
import { analytics, accounts, trades, Analytics, EquityPoint, Account, Trade } from '@/lib/api'
import { formatPnL, formatDuration, formatDate, getPnLColor, getSideBg, cn } from '@/lib/utils'
import { ChevronRight, RefreshCw, Plus } from 'lucide-react'
import Link from 'next/link'

const PERIODS = [
  { label: '7J',  value: '7d' },
  { label: '30J', value: '30d' },
  { label: '3M',  value: '90d' },
  { label: '1AN', value: '1y' },
  { label: 'TOUT',value: 'all' },
]

export default function DashboardPage() {
  const [period, setPeriod] = useState('30d')
  const [overview, setOverview] = useState<Analytics | null>(null)
  const [curve, setCurve] = useState<EquityPoint[]>([])
  const [accountList, setAccountList] = useState<Account[]>([])
  const [recentTrades, setRecentTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [ov, cv, accs, tr] = await Promise.all([
        analytics.overview(period),
        analytics.equityCurve(),
        accounts.list(),
        trades.list({ limit: 5, status: 'closed', sort: 'entry_time', order: 'desc' }),
      ])
      setOverview(ov.overview)
      setCurve(cv.equity_curve)
      setAccountList(accs.accounts)
      setRecentTrades(tr.trades)
    } catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  const totalBalance = accountList.reduce((s, a) => s + Number(a.current_balance || a.initial_balance || 0), 0)
  const openTrades   = accountList.reduce((s, a) => s + Number(a.open_trades || 0), 0)

  return (
    <AppLayout
      title="Dashboard"
      subtitle={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
    >
      {/* Period selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg p-1">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={cn(
                'px-2 sm:px-3 py-1.5 rounded-md text-xs font-mono font-semibold uppercase tracking-wider transition-all',
                period === value ? 'bg-accent text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(true)}
          className={cn('w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-light-hover dark:hover:bg-dark-hover transition-all', refreshing && 'animate-spin')}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPIs — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard
          label="P&L Net"
          value={formatPnL(overview?.total_pnl)}
          color={!overview ? 'default' : Number(overview.total_pnl) >= 0 ? 'profit' : 'loss'}
          trend={!overview ? undefined : Number(overview.total_pnl) >= 0 ? 'up' : 'down'}
          subvalue={`${overview?.total_trades || 0} trades`}
          loading={loading}
        />
        <StatCard
          label="Win Rate"
          value={overview ? `${overview.win_rate}%` : '—'}
          color={!overview ? 'default' : Number(overview.win_rate) >= 50 ? 'profit' : 'loss'}
          subvalue={overview ? `${overview.winning_trades}W / ${overview.losing_trades}L` : undefined}
          loading={loading}
        />
        <StatCard
          label="Profit Factor"
          value={overview?.profit_factor ? Number(overview.profit_factor).toFixed(2) : '—'}
          color={!overview?.profit_factor ? 'default' : Number(overview.profit_factor) >= 1.5 ? 'profit' : Number(overview.profit_factor) >= 1 ? 'warn' : 'loss'}
          loading={loading}
        />
        <StatCard
          label="R Moyen"
          value={overview?.avg_r ? `${Number(overview.avg_r) >= 0 ? '+' : ''}${Number(overview.avg_r).toFixed(2)}R` : '—'}
          color={!overview?.avg_r ? 'default' : Number(overview.avg_r) >= 1 ? 'profit' : Number(overview.avg_r) > 0 ? 'warn' : 'loss'}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Meilleur Trade" value={formatPnL(overview?.best_trade)}  color="profit" loading={loading} />
        <StatCard label="Pire Trade"     value={formatPnL(overview?.worst_trade)} color="loss"   loading={loading} />
        <StatCard label="Durée Moyenne"  value={formatDuration(overview?.avg_duration_seconds)} loading={loading} />
        <StatCard
          label="Trades Ouverts"
          value={openTrades}
          color={openTrades > 0 ? 'accent' : 'default'}
          subvalue={totalBalance ? `Solde: ${formatPnL(totalBalance)}` : undefined}
          loading={loading}
        />
      </div>

      {/* Equity curve + Comptes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-sm md:text-base uppercase tracking-wider text-gray-900 dark:text-white">
              Courbe de Performance
            </h2>
            {curve.length > 0 && (
              <span className={cn('text-sm font-mono font-semibold', getPnLColor(curve[curve.length - 1]?.cumulative_pnl))}>
                {formatPnL(curve[curve.length - 1]?.cumulative_pnl)}
              </span>
            )}
          </div>
          <EquityCurve data={curve} loading={loading} />
        </div>

        <div className="card p-4 md:p-5">
          <h2 className="font-display font-700 text-sm md:text-base uppercase tracking-wider text-gray-900 dark:text-white mb-4">
            Comptes
          </h2>
          {loading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
          ) : accountList.length === 0 ? (
            <div className="text-sm text-gray-500 font-mono text-center py-8">
              Aucun compte
              <Link href="/settings" className="block text-accent text-xs mt-2 hover:underline">Créer un compte →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {accountList.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-light-hover dark:bg-dark-hover">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{acc.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono uppercase">{acc.broker} · {acc.currency}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className={cn('text-sm font-mono font-semibold', getPnLColor(acc.total_pnl))}>
                      {formatPnL(acc.total_pnl)}
                    </div>
                    <div className="text-xs text-gray-500">{acc.total_trades || 0} trades</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent trades */}
      <div className="card">
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-light-border dark:border-dark-border">
          <h2 className="font-display font-700 text-sm md:text-base uppercase tracking-wider text-gray-900 dark:text-white">
            Derniers Trades
          </h2>
          <Link href="/trades" className="text-xs font-mono text-accent hover:underline flex items-center gap-1">
            Voir tout <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
        ) : recentTrades.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500 text-sm font-mono mb-3">Aucun trade fermé</p>
            <Link href="/trades/new" className="btn-primary inline-flex items-center gap-2 text-xs">
              <Plus size={12} /> Ajouter un trade
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
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
                      <td><span className="font-mono font-semibold text-sm">{trade.symbol}</span></td>
                      <td><span className={cn('badge', getSideBg(trade.side))}>{trade.side.toUpperCase()}</span></td>
                      <td><span className="font-mono text-sm">{Number(trade.entry_price).toLocaleString()}</span></td>
                      <td><span className="font-mono text-xs text-gray-500">{formatDate(trade.entry_time)}</span></td>
                      <td><span className={cn('font-mono font-semibold text-sm', getPnLColor(trade.net_pnl))}>{formatPnL(trade.net_pnl)}</span></td>
                      <td><span className={cn('font-mono text-sm', getPnLColor(trade.r_multiple))}>{trade.r_multiple ? `${Number(trade.r_multiple) > 0 ? '+' : ''}${Number(trade.r_multiple).toFixed(2)}R` : '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-light-border dark:divide-dark-border">
              {recentTrades.map(trade => (
                <div key={trade.id} className="flex items-center justify-between px-4 py-3 hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer" onClick={() => window.location.href = `/trades/${trade.id}`}>
                  <div className="flex items-center gap-3">
                    <span className={cn('badge', getSideBg(trade.side))}>{trade.side === 'long' ? '▲' : '▼'}</span>
                    <div>
                      <div className="font-mono font-semibold text-sm text-gray-900 dark:text-white">{trade.symbol}</div>
                      <div className="text-xs text-gray-500 font-mono">{formatDate(trade.entry_time)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn('font-mono font-semibold text-sm', getPnLColor(trade.net_pnl))}>{formatPnL(trade.net_pnl)}</div>
                    <div className={cn('text-xs font-mono', getPnLColor(trade.r_multiple))}>{trade.r_multiple ? `${Number(trade.r_multiple) > 0 ? '+' : ''}${Number(trade.r_multiple).toFixed(2)}R` : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
