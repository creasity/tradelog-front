'use client'

import { useEffect, useState, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { trades, accounts, Trade, Account, TradeFilters } from '@/lib/api'
import { formatPnL, formatDate, formatDuration, getPnLColor, getSideBg, cn } from '@/lib/utils'
import { Search, Filter, Plus, ChevronLeft, ChevronRight, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = ['', 'open', 'closed', 'cancelled']
const SIDE_OPTIONS = ['', 'long', 'short']
const SORT_OPTIONS = [
  { label: 'Date entrée', value: 'entry_time' },
  { label: 'P&L', value: 'net_pnl' },
  { label: 'Symbole', value: 'symbol' },
]

export default function TradesPage() {
  const router = useRouter()
  const [tradeList, setTradeList] = useState<Trade[]>([])
  const [accountList, setAccountList] = useState<Account[]>([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 20 })
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [filters, setFilters] = useState<TradeFilters>({
    page: 1, limit: 20, sort: 'entry_time', order: 'desc',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await trades.list(filters)
      setTradeList(data.trades)
      setPagination(data.pagination)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    accounts.list().then(d => setAccountList(d.accounts)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const setFilter = (key: keyof TradeFilters, value: string | number | undefined) => {
    setFilters(f => ({ ...f, [key]: value || undefined, page: 1 }))
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Supprimer ce trade ?')) return
    setDeleting(id)
    try {
      await trades.delete(id)
      load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDeleting(null)
    }
  }

  const totalPnL = tradeList.reduce((sum, t) => sum + (t.net_pnl || 0), 0)
  const wins = tradeList.filter(t => (t.net_pnl || 0) > 0).length
  const losses = tradeList.filter(t => (t.net_pnl || 0) < 0).length

  return (
    <AppLayout title="Trades" subtitle={`${pagination.total} trades au total`}>
      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="tl-input pl-9"
            placeholder="Symbole (ex: BTC, ETH...)"
            onChange={e => setFilter('symbol', e.target.value)}
          />
        </div>

        {/* Status */}
        <select className="tl-select w-36" onChange={e => setFilter('status', e.target.value)}>
          <option value="">Tous statuts</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {/* Side */}
        <select className="tl-select w-32" onChange={e => setFilter('side', e.target.value)}>
          <option value="">Long / Short</option>
          {SIDE_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.toUpperCase()}</option>
          ))}
        </select>

        {/* Account */}
        {accountList.length > 1 && (
          <select className="tl-select w-44" onChange={e => setFilter('account_id', e.target.value)}>
            <option value="">Tous les comptes</option>
            {accountList.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {/* Sort */}
        <select
          className="tl-select w-36"
          onChange={e => {
            const [sort, order] = e.target.value.split(':')
            setFilters(f => ({ ...f, sort, order, page: 1 }))
          }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={`${o.value}:desc`}>{o.label} ↓</option>
          ))}
          {SORT_OPTIONS.map(o => (
            <option key={`${o.value}-asc`} value={`${o.value}:asc`}>{o.label} ↑</option>
          ))}
        </select>

        <Link href="/trades/new" className="btn-primary flex items-center gap-2 ml-auto">
          <Plus size={14} /> Nouveau
        </Link>
      </div>

      {/* Summary bar */}
      {!loading && tradeList.length > 0 && (
        <div className="flex items-center gap-6 px-4 py-2.5 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg mb-4 text-xs font-mono">
          <span className="text-gray-400">{tradeList.length} affichés</span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>P&L: <span className={getPnLColor(totalPnL)}>{formatPnL(totalPnL)}</span></span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-profit">{wins}W</span>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span className="text-loss">{losses}L</span>
          {(wins + losses) > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <span className={wins / (wins + losses) >= 0.5 ? 'text-profit' : 'text-loss'}>
                {((wins / (wins + losses)) * 100).toFixed(0)}% WR
              </span>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 rounded" />)}
          </div>
        ) : tradeList.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-sm font-mono mb-4">Aucun trade trouvé</p>
            <Link href="/trades/new" className="btn-primary inline-flex items-center gap-2">
              <Plus size={14} /> Ajouter un trade
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tl-table">
              <thead>
                <tr>
                  <th>Symbole</th>
                  <th>Direction</th>
                  <th>Entrée</th>
                  <th>Sortie</th>
                  <th>Qté</th>
                  <th>Durée</th>
                  <th>P&L Net</th>
                  <th>R</th>
                  <th>Score</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tradeList.map(trade => (
                  <tr
                    key={trade.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/trades/${trade.id}`)}
                  >
                    <td>
                      <div>
                        <span className="font-mono font-semibold text-sm text-gray-900 dark:text-white">{trade.symbol}</span>
                        {trade.timeframe && <span className="ml-1.5 text-xs text-gray-400 font-mono">{trade.timeframe}</span>}
                      </div>
                      {trade.setup_tags && trade.setup_tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {trade.setup_tags.slice(0, 2).map(tag => (
                            <span key={tag} className="badge bg-accent/10 text-accent text-[10px]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={cn('badge', getSideBg(trade.side))}>
                        {trade.side.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="font-mono text-sm">{Number(trade.entry_price).toLocaleString()}</div>
                      <div className="text-xs text-gray-400 font-mono">{formatDate(trade.entry_time)}</div>
                    </td>
                    <td>
                      {trade.exit_price ? (
                        <>
                          <div className="font-mono text-sm">{Number(trade.exit_price).toLocaleString()}</div>
                          <div className="text-xs text-gray-400 font-mono">{formatDate(trade.exit_time)}</div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 font-mono">En cours</span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-sm">{Number(trade.quantity).toLocaleString()}</span>
                      {(trade.leverage || 1) > 1 && (
                        <span className="text-xs text-warn ml-1">{trade.leverage}x</span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-xs text-gray-400">{formatDuration(trade.duration_seconds)}</span>
                    </td>
                    <td>
                      <span className={cn('font-mono font-semibold text-sm', getPnLColor(trade.net_pnl))}>
                        {trade.net_pnl !== null && trade.net_pnl !== undefined ? formatPnL(trade.net_pnl) : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={cn('font-mono text-sm', getPnLColor(trade.r_multiple))}>
                        {trade.r_multiple ? `${trade.r_multiple > 0 ? '+' : ''}${Number(trade.r_multiple).toFixed(2)}R` : '—'}
                      </span>
                    </td>
                    <td>
                      {trade.ai_score !== null && trade.ai_score !== undefined ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${trade.ai_score * 100}%`,
                                background: trade.ai_score >= 0.7 ? '#00d17a' : trade.ai_score >= 0.4 ? '#f5a623' : '#ff3b5c'
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-400">{(trade.ai_score * 100).toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td>
                      <span className={cn(
                        'badge',
                        trade.status === 'open' ? 'bg-accent/10 text-accent' :
                        trade.status === 'closed' ? 'bg-gray-500/10 text-gray-400' :
                        'bg-loss/10 text-loss'
                      )}>
                        {trade.status === 'open' ? 'OUVERT' : trade.status === 'closed' ? 'FERMÉ' : 'ANNULÉ'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={(e) => handleDelete(trade.id, e)}
                        disabled={deleting === trade.id}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-loss hover:bg-loss/10 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-400 font-mono">
            Page {pagination.page} / {pagination.pages} — {pagination.total} trades
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
              disabled={pagination.page <= 1}
              className="btn-secondary flex items-center gap-1 !py-1.5 !px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Préc.
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
              disabled={pagination.page >= pagination.pages}
              className="btn-secondary flex items-center gap-1 !py-1.5 !px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suiv. <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
