'use client'

import { useEffect, useState, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { trades, accounts, Trade, Account, TradeFilters } from '@/lib/api'
import { formatPnL, formatDate, formatDuration, getPnLColor, getSideBg, cn } from '@/lib/utils'
import { Search, Plus, ChevronLeft, ChevronRight, Trash2, Filter, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function TradesPage() {
  const router = useRouter()
  const [tradeList, setTradeList]     = useState<Trade[]>([])
  const [accountList, setAccountList] = useState<Account[]>([])
  const [pagination, setPagination]   = useState({ total: 0, page: 1, pages: 1, limit: 20 })
  const [loading, setLoading]         = useState(true)
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingBulk, setDeletingBulk] = useState(false)

  const [filters, setFilters] = useState<TradeFilters>({
    page: 1, limit: 20, sort: 'entry_time', order: 'desc',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await trades.list(filters)
      setTradeList(data.trades)
      setPagination(data.pagination)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => {
    accounts.list().then(d => setAccountList(d.accounts)).catch(() => {})
  }, [])

  useEffect(() => { load(); setSelected(new Set()) }, [load])

  const setFilter = (key: keyof TradeFilters, value: string | number | undefined) =>
    setFilters(f => ({ ...f, [key]: value || undefined, page: 1 }))

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Supprimer ce trade ?')) return
    setDeleting(id)
    try { await trades.delete(id); load() }
    catch (err: any) { alert(err.message) }
    finally { setDeleting(null) }
  }

  const totalPnL = tradeList.reduce((s, t) => s + Number(t.net_pnl || 0), 0)
  const wins     = tradeList.filter(t => Number(t.net_pnl || 0) > 0).length
  const losses   = tradeList.filter(t => Number(t.net_pnl || 0) < 0).length

  return (
    <AppLayout title="Trades" subtitle={`${pagination.total} trades au total`}>

      {/* Actions bar */}
      <div className="flex items-center gap-2 mb-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="tl-input pl-9"
            placeholder="Symbole..."
            onChange={e => setFilter('symbol', e.target.value)}
          />
        </div>

        {/* Filter toggle on mobile */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'md:hidden w-10 h-10 flex items-center justify-center rounded-lg border transition-all flex-shrink-0',
            showFilters
              ? 'bg-accent text-white border-accent'
              : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-gray-500 dark:text-gray-400'
          )}
        >
          <Filter size={15} />
        </button>

        {/* Desktop filters inline */}
        <div className="hidden md:flex items-center gap-2">
          <select className="tl-select w-36" onChange={e => setFilter('status', e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <select className="tl-select w-28" onChange={e => setFilter('side', e.target.value)}>
            <option value="">Long/Short</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          {accountList.length > 1 && (
            <select className="tl-select w-40" onChange={e => setFilter('account_id', e.target.value)}>
              <option value="">Tous comptes</option>
              {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>

        <Link href="/trades/new" className="btn-primary flex items-center gap-1.5 flex-shrink-0 !px-3 md:!px-5">
          <Plus size={14} /> <span className="hidden sm:inline">Nouveau</span>
        </Link>
      </div>

      {/* Mobile filters panel */}
      {showFilters && (
        <div className="md:hidden card p-4 mb-3 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-500">Filtres</span>
            <button onClick={() => setShowFilters(false)} className="text-gray-400"><X size={14} /></button>
          </div>
          <select className="tl-select w-full" onChange={e => setFilter('status', e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <select className="tl-select w-full" onChange={e => setFilter('side', e.target.value)}>
            <option value="">Long / Short</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          {accountList.length > 1 && (
            <select className="tl-select w-full" onChange={e => setFilter('account_id', e.target.value)}>
              <option value="">Tous les comptes</option>
              {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Summary bar */}
      {!loading && tradeList.length > 0 && (
        <div className="flex items-center gap-3 md:gap-6 px-3 md:px-4 py-2.5 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg mb-3 text-xs font-mono flex-wrap">
          <span className="text-gray-500">{tradeList.length} affichés</span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">·</span>
          <span>P&L: <span className={getPnLColor(totalPnL)}>{formatPnL(totalPnL)}</span></span>
          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">·</span>
          <span>
            <span className="text-profit">{wins}W</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className="text-loss">{losses}L</span>
            {(wins + losses) > 0 && (
              <span className={cn('ml-2', Number(wins / (wins + losses)) >= 0.5 ? 'text-profit' : 'text-loss')}>
                {((wins / (wins + losses)) * 100).toFixed(0)}% WR
              </span>
            )}
          </span>
        </div>
      )}


      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-accent/10 border border-accent/30 rounded-lg mb-3 text-sm font-mono">
          <span className="text-accent font-semibold">{selected.size} trade{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white">
              Désélectionner tout
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 text-xs text-loss hover:bg-loss/10 px-3 py-1.5 rounded-lg transition-all border border-loss/30"
            >
              {deletingBulk ? <span className="w-3 h-3 border-2 border-loss border-t-transparent rounded-full animate-spin" /> : <Trash2 size={13} />}
              Supprimer la sélection
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card p-4 space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded" />)}
        </div>
      ) : tradeList.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-gray-500 text-sm font-mono mb-4">Aucun trade trouvé</p>
          <Link href="/trades/new" className="btn-primary inline-flex items-center gap-2">
            <Plus size={14} /> Ajouter un trade
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
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
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tradeList.map(trade => (
                    <tr key={trade.id} className={cn('cursor-pointer', selected.has(trade.id) && 'bg-accent/5')} onClick={() => router.push(`/trades/${trade.id}`)}>
                      <td className="pr-0" onClick={e => { e.stopPropagation(); toggleSelect(trade.id) }}>
                        <button className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                          {selected.has(trade.id) ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                        </button>
                      </td>
                      <td>
                        <div className="font-mono font-semibold text-sm text-gray-900 dark:text-white">{trade.symbol}</div>
                        {trade.setup_tags?.length ? (
                          <div className="flex gap-1 mt-0.5">
                            {trade.setup_tags.slice(0, 1).map(tag => (
                              <span key={tag} className="badge bg-accent/10 text-accent text-[10px]">{tag}</span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td><span className={cn('badge', getSideBg(trade.side))}>{trade.side.toUpperCase()}</span></td>
                      <td>
                        <div className="font-mono text-sm">{Number(trade.entry_price).toLocaleString()}</div>
                        <div className="text-xs text-gray-500 font-mono">{formatDate(trade.entry_time)}</div>
                      </td>
                      <td>
                        {trade.exit_price ? (
                          <>
                            <div className="font-mono text-sm">{Number(trade.exit_price).toLocaleString()}</div>
                            <div className="text-xs text-gray-500 font-mono">{formatDate(trade.exit_time)}</div>
                          </>
                        ) : <span className="text-xs text-gray-400 font-mono">—</span>}
                      </td>
                      <td>
                        <span className="font-mono text-sm">{Number(trade.quantity).toLocaleString()}</span>
                        {Number(trade.leverage || 1) > 1 && <span className="text-xs text-warn ml-1">{trade.leverage}x</span>}
                      </td>
                      <td><span className="font-mono text-xs text-gray-500">{formatDuration(trade.duration_seconds)}</span></td>
                      <td><span className={cn('font-mono font-semibold text-sm', getPnLColor(trade.net_pnl))}>{formatPnL(trade.net_pnl)}</span></td>
                      <td><span className={cn('font-mono text-sm', getPnLColor(trade.r_multiple))}>{trade.r_multiple ? `${Number(trade.r_multiple) > 0 ? '+' : ''}${Number(trade.r_multiple).toFixed(2)}R` : '—'}</span></td>
                      <td>
                        <span className={cn('badge',
                          trade.status === 'open' ? 'bg-accent/10 text-accent' : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
                        )}>
                          {trade.status === 'open' ? 'OUVERT' : 'FERMÉ'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={(e) => handleDelete(trade.id, e)}
                          disabled={deleting === trade.id}
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-loss hover:bg-loss/10 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {tradeList.map(trade => (
              <div
                key={trade.id}
                className="card p-4 cursor-pointer active:bg-light-hover dark:active:bg-dark-hover transition-all"
                onClick={() => router.push(`/trades/${trade.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('badge', getSideBg(trade.side))}>{trade.side === 'long' ? '▲ L' : '▼ S'}</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">{trade.symbol}</span>
                    {trade.timeframe && <span className="text-xs text-gray-500 font-mono">{trade.timeframe}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('font-mono font-bold text-base', getPnLColor(trade.net_pnl))}>
                      {formatPnL(trade.net_pnl)}
                    </span>
                    <button
                      onClick={(e) => handleDelete(trade.id, e)}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-loss"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                    <div className="text-gray-500 mb-0.5">Entrée</div>
                    <div className="text-gray-800 dark:text-gray-200">{Number(trade.entry_price).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-0.5">Sortie</div>
                    <div className="text-gray-800 dark:text-gray-200">{trade.exit_price ? Number(trade.exit_price).toLocaleString() : '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-0.5">R Multiple</div>
                    <div className={getPnLColor(trade.r_multiple)}>
                      {trade.r_multiple ? `${Number(trade.r_multiple) > 0 ? '+' : ''}${Number(trade.r_multiple).toFixed(2)}R` : '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-light-border dark:border-dark-border">
                  <span className="text-xs text-gray-500 font-mono">{formatDate(trade.entry_time, 'long')}</span>
                  <span className={cn('badge text-[10px]',
                    trade.status === 'open' ? 'bg-accent/10 text-accent' : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
                  )}>
                    {trade.status === 'open' ? 'OUVERT' : 'FERMÉ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500 font-mono">{pagination.page}/{pagination.pages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
              disabled={pagination.page <= 1}
              className="btn-secondary flex items-center gap-1 !py-1.5 !px-3 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
              disabled={pagination.page >= pagination.pages}
              className="btn-secondary flex items-center gap-1 !py-1.5 !px-3 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
