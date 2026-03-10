'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { trades, accounts, Trade, Account, TradeFilters } from '@/lib/api'
import { formatPnL, formatDate, formatDuration, getPnLColor, cn, toNum } from '@/lib/utils'
import {
  Search, Plus, ChevronLeft, ChevronRight, Trash2, X,
  CheckSquare, Square, FileImage, ChevronUp, ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

// ── Types & helpers ────────────────────────────────────────────────────────────

function tradeOutcome(t: Trade): 'WIN' | 'LOSS' | 'BE' | 'OPEN' {
  if (t.status === 'open') return 'OPEN'
  const pnl = toNum(t.net_pnl)
  if (pnl > 0) return 'WIN'
  if (pnl < 0) return 'LOSS'
  return 'BE'
}

const OC = {
  WIN:  { dot: '#00d17a', cls: 'text-[#00d17a]' },
  LOSS: { dot: '#ff3b5c', cls: 'text-[#ff3b5c]' },
  BE:   { dot: '#4f8ef7', cls: 'text-[#4f8ef7]' },
  OPEN: { dot: '#9ca3af', cls: 'text-gray-400'   },
}

function fmtAmt(v: any) {
  const n = toNum(v)
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}k`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function fmtPrice(v: any) {
  const n = toNum(v)
  if (!n) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 }).replace(/\.?0+$/, '')
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PRESETS = [
  { id: 'today',   label: "Auj'" },
  { id: 'hier',    label: 'Hier'  },
  { id: 'sem',     label: 'Sem.'  },
  { id: 'sem-1',   label: 'Sem-1' },
  { id: 'mois',    label: 'Mois'  },
  { id: 'mois-1',  label: 'Mois-1'},
  { id: '3m',      label: '3M'    },
  { id: 'annee',   label: 'Année' },
  { id: 'annee-1', label: 'An-1'  },
]

function getPresetRange(id: string): { from: Date; to: Date } {
  const now  = new Date()
  const tod  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ms   = (d: number) => new Date(d)
  const D    = 86_400_000
  switch (id) {
    case 'today':   return { from: tod, to: now }
    case 'hier':    return { from: ms(tod.getTime() - D), to: ms(tod.getTime() - 1) }
    case 'sem': {
      const dw = tod.getDay() || 7
      return { from: ms(tod.getTime() - (dw - 1) * D), to: now }
    }
    case 'sem-1': {
      const dw  = tod.getDay() || 7
      const mon = ms(tod.getTime() - (dw - 1) * D)
      return { from: ms(mon.getTime() - 7 * D), to: ms(mon.getTime() - 1) }
    }
    case 'mois':    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
    case 'mois-1':  return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    }
    case '3m':      return { from: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()), to: now }
    case 'annee':   return { from: new Date(now.getFullYear(), 0, 1), to: now }
    case 'annee-1': return {
      from: new Date(now.getFullYear() - 1, 0, 1),
      to:   new Date(now.getFullYear(), 0, 0, 23, 59, 59),
    }
    default:        return { from: ms(now.getTime() - 90 * D), to: now }
  }
}

// ── Ring progress ─────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 26 }: { pct: number; color: string; size?: number }) {
  const r    = (size - 5) / 2
  const circ = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(150,150,150,0.18)" strokeWidth={2.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

// ── Side arrow (zigzag) ───────────────────────────────────────────────────────

function SideArrow({ side }: { side: 'long' | 'short' }) {
  const c = side === 'long' ? '#00d17a' : '#ff3b5c'
  return (
    <svg width={13} height={13} viewBox="0 0 13 13">
      {side === 'long'
        ? <polyline points="1,11 4,6 8,8 12,2" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
        : <polyline points="1,2 4,7 8,5 12,11" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
      }
    </svg>
  )
}

// ── Stat box ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, pct, color }: { label: string; value: string | number; pct: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-black/5 dark:bg-white/3 border border-transparent hover:border-white/5 transition-colors">
      <div className="min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500">{label}</div>
        <div className="text-xs font-mono font-bold mt-0.5 truncate" style={{ color }}>{value}</div>
      </div>
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
        <Ring pct={pct} color={color} size={24} />
        <span className="text-[8px] font-mono text-gray-500 leading-none">{pct.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// ── Timeline slider ───────────────────────────────────────────────────────────

function TimelineSlider({
  baseFrom, baseTo, tradeList, leftPos, rightPos, onRange,
}: {
  baseFrom: Date; baseTo: Date; tradeList: Trade[]
  leftPos: number; rightPos: number
  onRange: (l: number, r: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef  = useRef<'left' | 'right' | null>(null)
  const lRef     = useRef(leftPos)
  const rRef     = useRef(rightPos)
  lRef.current   = leftPos
  rRef.current   = rightPos

  const baseMs  = baseFrom.getTime()
  const rangeMs = baseTo.getTime() - baseMs

  const markerPositions = useMemo(() => {
    const seen = new Set<string>()
    const result: number[] = []
    tradeList.forEach(t => {
      const d = new Date(t.entry_time)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!seen.has(key)) {
        seen.add(key)
        const pos = rangeMs > 0 ? (d.getTime() - baseMs) / rangeMs : 0.5
        if (pos >= 0 && pos <= 1) result.push(pos)
      }
    })
    return result
  }, [tradeList, baseMs, rangeMs])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const pos  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      if (dragRef.current === 'left')  onRange(Math.min(pos, rRef.current - 0.01), rRef.current)
      else                              onRange(lRef.current, Math.max(pos, lRef.current + 0.01))
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onRange])

  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

  return (
    <div className="px-1">
      <div ref={trackRef} className="relative h-7 select-none">
        {/* Track bg */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-light-border dark:bg-dark-border rounded-full" />
        {/* Selected range fill */}
        <div className="absolute top-1/2 -translate-y-1/2 h-[3px] bg-accent/40 rounded-full"
          style={{ left: `${leftPos * 100}%`, width: `${(rightPos - leftPos) * 100}%` }} />
        {/* Trade day markers */}
        {markerPositions.map((pos, i) => (
          <div key={i} className="absolute top-0 bottom-0 w-px bg-accent/30 pointer-events-none"
            style={{ left: `${pos * 100}%` }} />
        ))}
        {/* Left handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-5 bg-accent rounded cursor-ew-resize shadow-lg z-10 hover:bg-accent/80 transition-colors"
          style={{ left: `${leftPos * 100}%` }}
          onMouseDown={e => { e.preventDefault(); dragRef.current = 'left' }}
        />
        {/* Right handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-5 bg-accent rounded cursor-ew-resize shadow-lg z-10 hover:bg-accent/80 transition-colors"
          style={{ left: `${rightPos * 100}%` }}
          onMouseDown={e => { e.preventDefault(); dragRef.current = 'right' }}
        />
      </div>
      {/* Date labels under track */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] font-mono text-gray-500">{fmt(baseFrom)}</span>
        <span className="text-[10px] font-mono text-gray-500">{fmt(baseTo)}</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TradesPage() {
  const router = useRouter()

  const [tradeList,    setTradeList]    = useState<Trade[]>([])
  const [accountList,  setAccountList]  = useState<Account[]>([])
  const [pagination,   setPagination]   = useState({ total: 0, page: 1, pages: 1, limit: 50 })
  const [loading,      setLoading]      = useState(true)
  const [deleting,     setDeleting]     = useState<string | null>(null)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [attachPopup,  setAttachPopup]  = useState<Trade | null>(null)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [baseRange,    setBaseRange]    = useState<{ from: Date; to: Date } | null>(null)
  const [sliderL,      setSliderL]      = useState(0)
  const [sliderR,      setSliderR]      = useState(1)

  const [filters, setFilters] = useState<TradeFilters>({
    page: 1, limit: 50, sort: 'entry_time', order: 'desc',
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

  // Auto-set baseRange from trade dates when no preset active
  useEffect(() => {
    if (!baseRange && tradeList.length >= 2) {
      const times = tradeList.map(t => new Date(t.entry_time).getTime())
      const minT  = times.reduce((a, b) => a < b ? a : b)
      const maxT  = times.reduce((a, b) => a > b ? a : b)
      if (maxT > minT) setBaseRange({ from: new Date(minT), to: new Date(maxT) })
    }
  }, [tradeList, baseRange])

  const displayBaseRange = useMemo(() => {
    if (baseRange) return baseRange
    const now = new Date()
    return { from: new Date(now.getTime() - 90 * 86_400_000), to: now }
  }, [baseRange])

  const setFilter = (key: keyof TradeFilters, value: any) =>
    setFilters(f => ({ ...f, [key]: value || undefined, page: 1 }))

  const setSort = (col: string) =>
    setFilters(f => ({
      ...f, sort: col,
      order: f.sort === col && f.order === 'desc' ? 'asc' : 'desc',
      page: 1,
    }))

  const applyPreset = (id: string) => {
    const range = getPresetRange(id)
    setActivePreset(id)
    setBaseRange(range)
    setSliderL(0)
    setSliderR(1)
    setFilters(f => ({
      ...f,
      date_from: range.from.toISOString(),
      date_to:   range.to.toISOString(),
      page: 1,
    }))
  }

  const resetFilters = () => {
    setActivePreset(null)
    setBaseRange(null)
    setSliderL(0)
    setSliderR(1)
    setFilters({ page: 1, limit: 50, sort: 'entry_time', order: 'desc' })
  }

  const handleSlider = useCallback((l: number, r: number) => {
    setSliderL(l)
    setSliderR(r)
    setActivePreset(null)
    const rangeMs = displayBaseRange.to.getTime() - displayBaseRange.from.getTime()
    const from    = new Date(displayBaseRange.from.getTime() + l * rangeMs)
    const to      = new Date(displayBaseRange.from.getTime() + r * rangeMs)
    setFilters(f => ({ ...f, date_from: from.toISOString(), date_to: to.toISOString(), page: 1 }))
  }, [displayBaseRange])

  // Stats
  const stats = useMemo(() => {
    const total   = tradeList.length || 1
    const closed  = tradeList.filter(t => t.status !== 'open').length
    const wins    = tradeList.filter(t => toNum(t.net_pnl) > 0)
    const losses  = tradeList.filter(t => toNum(t.net_pnl) < 0)
    const be      = tradeList.filter(t => t.status !== 'open' && toNum(t.net_pnl) === 0)
    const open    = tradeList.filter(t => t.status === 'open')
    const avgW    = wins.length   ? wins.reduce((s, t) => s + toNum(t.net_pnl), 0) / wins.length   : 0
    const avgL    = losses.length ? losses.reduce((s, t) => s + toNum(t.net_pnl), 0) / losses.length : 0
    const netPnL  = tradeList.reduce((s, t) => s + toNum(t.net_pnl), 0)
    const wr      = closed > 0 ? (wins.length / closed) * 100 : 0
    return {
      total, closed,
      wins: wins.length, losses: losses.length, be: be.length, open: open.length,
      avgW, avgL, netPnL, wr,
    }
  }, [tradeList])

  // Equity curve from closed trades sorted by time
  const equityData = useMemo(() => {
    const sorted = [...tradeList]
      .filter(t => t.status !== 'open')
      .sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
    let cum = 0
    return sorted.map(t => ({ v: (cum += toNum(t.net_pnl)) }))
  }, [tradeList])

  // Selection
  const allIds      = tradeList.map(t => t.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = () => setSelected(allSelected ? new Set<string>() : new Set(allIds))

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Supprimer ce trade ?')) return
    setDeleting(id)
    try { await trades.delete(id); load() }
    catch (err: any) { alert(err.message) }
    finally { setDeleting(null) }
  }

  const handleDeleteSelected = async () => {
    if (!selected.size || !confirm(`Supprimer ${selected.size} trade(s) ?`)) return
    setDeletingBulk(true)
    try {
      await Promise.all(Array.from(selected).map(id => trades.delete(id)))
      setSelected(new Set<string>())
      load()
    } catch (err: any) { alert(err.message) }
    finally { setDeletingBulk(false) }
  }

  const pnlColor = stats.netPnL >= 0 ? '#00d17a' : '#ff3b5c'

  // Sort icon
  const SortIco = ({ col }: { col: string }) =>
    filters.sort !== col
      ? <ChevronUp size={9} className="opacity-25 text-gray-400" />
      : filters.order === 'asc'
        ? <ChevronUp size={9} className="text-accent" />
        : <ChevronDown size={9} className="text-accent" />

  // Sortable columns (backend allowedSort: entry_time, exit_time, net_pnl, symbol, created_at)
  const COLS = [
    { key: 'entry_time', label: 'Date'      },
    { key: 'symbol',     label: 'Symbole'   },
    { key: null,         label: 'Statut'    },
    { key: null,         label: 'Side'      },
    { key: null,         label: 'Px ent.'   },
    { key: null,         label: 'Px sort.'  },
    { key: null,         label: 'Mnt ent.'  },
    { key: null,         label: 'Mnt sort.' },
    { key: null,         label: 'Durée'     },
    { key: 'net_pnl',    label: 'Retour'    },
    { key: null,         label: ''          }, // attachments
    { key: null,         label: ''          }, // trash
  ]

  return (
    <AppLayout
      title="Trades"
      subtitle={`${pagination.total} trades`}
      topbarContent={
        <div className="flex items-center gap-3 w-full min-w-0">
          {/* Presets — 2 rows */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <div className="flex items-center gap-1">
              {PRESETS.slice(0, 5).map(p => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    'px-2 py-[3px] rounded text-[10px] font-mono font-medium transition-all border whitespace-nowrap',
                    activePreset === p.id
                      ? 'bg-accent text-white border-accent'
                      : 'text-gray-500 dark:text-gray-400 border-light-border dark:border-dark-border hover:border-accent hover:text-accent'
                  )}
                >{p.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {PRESETS.slice(5).map(p => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    'px-2 py-[3px] rounded text-[10px] font-mono font-medium transition-all border whitespace-nowrap',
                    activePreset === p.id
                      ? 'bg-accent text-white border-accent'
                      : 'text-gray-500 dark:text-gray-400 border-light-border dark:border-dark-border hover:border-accent hover:text-accent'
                  )}
                >{p.label}</button>
              ))}
              <button
                onClick={resetFilters}
                className="px-2 py-[3px] rounded text-[10px] font-mono text-gray-400 border border-light-border dark:border-dark-border hover:text-loss hover:border-loss transition-all"
              >Reset</button>
            </div>
          </div>

          {/* Timeline slider — takes remaining space */}
          <div className="flex-1 min-w-0 max-w-xl">
            <TimelineSlider
              baseFrom={displayBaseRange.from}
              baseTo={displayBaseRange.to}
              tradeList={tradeList}
              leftPos={sliderL}
              rightPos={sliderR}
              onRange={handleSlider}
            />
          </div>
        </div>
      }
    >

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="tl-input pl-8 text-xs"
            placeholder="Symbole…"
            onChange={e => setFilter('symbol', e.target.value)}
          />
        </div>
        {accountList.length > 1 && (
          <select className="tl-select text-xs w-36" onChange={e => setFilter('account_id', e.target.value)}>
            <option value="">Tous comptes</option>
            {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        <select className="tl-select text-xs w-24" onChange={e => setFilter('side', e.target.value)}>
          <option value="">L / S</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <Link href="/trades/new" className="btn-primary flex items-center gap-1.5 !px-3 !py-2 flex-shrink-0">
          <Plus size={13} /><span className="hidden sm:inline text-xs">Nouveau</span>
        </Link>
      </div>

      {/* Presets + Timeline moved to topbar */}

      {/* ── Stats section ───────────────────────────────────────── */}
      {!loading && tradeList.length > 0 && (
        <div className="card p-3 mb-3 flex flex-col sm:flex-row gap-3 items-stretch">

          {/* Mini equity chart */}
          <div className="flex-shrink-0 w-full sm:w-28 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ecg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={pnlColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={pnlColor} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={pnlColor} strokeWidth={1.5}
                  fill="url(#ecg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Stat boxes */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            <StatBox label="Wins"   value={stats.wins}    pct={stats.wins   / stats.total * 100} color="#00d17a" />
            <StatBox label="Losses" value={stats.losses}  pct={stats.losses / stats.total * 100} color="#ff3b5c" />
            <StatBox label="BE"     value={stats.be}      pct={stats.be     / stats.total * 100} color="#4f8ef7" />
            <StatBox label="Open"   value={stats.open}    pct={stats.open   / stats.total * 100} color="#9ca3af" />
            <StatBox
              label="Avg W"
              value={stats.avgW ? `+$${stats.avgW.toFixed(1)}` : '—'}
              pct={stats.wr}
              color="#00d17a"
            />
            <StatBox
              label="Avg L"
              value={stats.avgL ? `-$${Math.abs(stats.avgL).toFixed(1)}` : '—'}
              pct={stats.closed > 0 ? (stats.losses / stats.closed * 100) : 0}
              color="#ff3b5c"
            />
          </div>

          {/* PnL summary box */}
          <div className={cn(
            'flex-shrink-0 w-full sm:w-28 flex flex-col items-center justify-center rounded-xl border px-3 py-2',
            stats.netPnL >= 0 ? 'border-[#00d17a]/25 bg-[#00d17a]/5' : 'border-[#ff3b5c]/25 bg-[#ff3b5c]/5'
          )}>
            <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">P&L Net</div>
            <div className="font-mono font-bold text-sm leading-tight" style={{ color: pnlColor }}>
              {formatPnL(stats.netPnL)}
            </div>
            <div className="text-[11px] font-mono mt-1" style={{ color: pnlColor }}>
              {stats.wr.toFixed(1)}% WR
            </div>
            <div className="text-[9px] font-mono text-gray-500 mt-0.5">
              {stats.wins}W / {stats.losses}L
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk action bar ─────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-accent/10 border border-accent/30 rounded-lg mb-3 text-sm font-mono">
          <span className="text-accent font-semibold text-xs">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white">
              Désélect. tout
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 text-xs text-loss hover:bg-loss/10 px-3 py-1.5 rounded-lg border border-loss/30 transition-all"
            >
              {deletingBulk
                ? <span className="w-3 h-3 border border-loss border-t-transparent rounded-full animate-spin" />
                : <Trash2 size={12} />
              }
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* ── Trade table ─────────────────────────────────────────── */}
      {loading ? (
        <div className="card p-4 space-y-2.5">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-11 rounded" />)}
        </div>
      ) : tradeList.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-mono text-gray-500 mb-4">Aucun trade trouvé</p>
          <Link href="/trades/new" className="btn-primary inline-flex items-center gap-2">
            <Plus size={13} /> Nouveau trade
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tl-table" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  {/* Checkbox header */}
                  <th className="w-8 pr-0">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-accent flex items-center">
                      {allSelected
                        ? <CheckSquare size={13} className="text-accent" />
                        : <Square size={13} />
                      }
                    </button>
                  </th>
                  {COLS.map((col, i) => (
                    <th
                      key={i}
                      className={cn(col.key ? 'cursor-pointer select-none hover:text-accent' : '')}
                      onClick={() => col.key && setSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.key && <SortIco col={col.key} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tradeList.map(trade => {
                  const outcome  = tradeOutcome(trade)
                  const oc       = OC[outcome]
                  const mntEnt   = toNum(trade.entry_price) * toNum(trade.quantity)
                  const mntSort  = trade.exit_price ? toNum(trade.exit_price) * toNum(trade.quantity) : null
                  const hasFiles = Array.isArray((trade as any).screenshots) && (trade as any).screenshots.length > 0
                  const isPopup  = attachPopup?.id === trade.id

                  return (
                    <tr
                      key={trade.id}
                      className={cn('cursor-pointer', selected.has(trade.id) && 'bg-accent/5')}
                      onClick={() => router.push(`/trades/${trade.id}`)}
                    >
                      {/* Checkbox */}
                      <td className="pr-0 w-8" onClick={e => { e.stopPropagation(); toggleSelect(trade.id) }}>
                        <button className="text-gray-400 hover:text-accent flex items-center">
                          {selected.has(trade.id)
                            ? <CheckSquare size={13} className="text-accent" />
                            : <Square size={13} />
                          }
                        </button>
                      </td>

                      {/* Date */}
                      <td>
                        <div className="font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {formatDate(trade.entry_time, 'short')}
                        </div>
                        <div className="font-mono text-gray-400" style={{ fontSize: '10px' }}>
                          {new Date(trade.entry_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Symbol */}
                      <td>
                        <div className="font-mono font-bold text-gray-900 dark:text-white">{trade.symbol}</div>
                        {trade.timeframe && (
                          <div className="text-gray-400 font-mono" style={{ fontSize: '9px' }}>{trade.timeframe}</div>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: oc.dot }} />
                          <span className={cn('font-mono font-bold', oc.cls)}>{outcome}</span>
                        </div>
                      </td>

                      {/* Side */}
                      <td>
                        <div className="flex items-center gap-1">
                          <SideArrow side={trade.side} />
                          <span className={cn('font-mono font-semibold', trade.side === 'long' ? 'text-[#00d17a]' : 'text-[#ff3b5c]')}>
                            {trade.side === 'long' ? 'LONG' : 'SHORT'}
                          </span>
                        </div>
                      </td>

                      {/* Px entrée */}
                      <td>
                        <span className="font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {fmtPrice(trade.entry_price)}
                        </span>
                      </td>

                      {/* Px sortie */}
                      <td>
                        <span className="font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {trade.exit_price ? fmtPrice(trade.exit_price) : '—'}
                        </span>
                      </td>

                      {/* Mnt entrée */}
                      <td>
                        <span className="font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {mntEnt ? fmtAmt(mntEnt) : '—'}
                        </span>
                      </td>

                      {/* Mnt sortie */}
                      <td>
                        <span className="font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {mntSort ? fmtAmt(mntSort) : '—'}
                        </span>
                      </td>

                      {/* Durée */}
                      <td>
                        <span className="font-mono text-gray-500 whitespace-nowrap">
                          {formatDuration(trade.duration_seconds)}
                        </span>
                      </td>

                      {/* Retour */}
                      <td>
                        <span className={cn('font-mono font-bold whitespace-nowrap', getPnLColor(trade.net_pnl))}>
                          {formatPnL(trade.net_pnl)}
                        </span>
                      </td>

                      {/* Attachments */}
                      <td className="w-7">
                        {hasFiles ? (
                          <button
                            onClick={e => { e.stopPropagation(); setAttachPopup(isPopup ? null : trade) }}
                            className={cn(
                              'w-6 h-6 flex items-center justify-center rounded transition-all',
                              isPopup ? 'text-accent bg-accent/15' : 'text-gray-400 hover:text-accent hover:bg-accent/10'
                            )}
                          >
                            <FileImage size={12} />
                          </button>
                        ) : null}
                      </td>

                      {/* Delete */}
                      <td className="w-7">
                        <button
                          onClick={e => handleDelete(trade.id, e)}
                          disabled={deleting === trade.id}
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-loss hover:bg-loss/10 transition-all"
                        >
                          {deleting === trade.id
                            ? <span className="w-3 h-3 border border-loss border-t-transparent rounded-full animate-spin" />
                            : <Trash2 size={12} />
                          }
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────── */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500 font-mono">
            Page {pagination.page}/{pagination.pages} · {pagination.total} trades
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
              disabled={pagination.page <= 1}
              className="btn-secondary !py-1.5 !px-3 disabled:opacity-40"
            ><ChevronLeft size={13} /></button>
            <button
              onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
              disabled={pagination.page >= pagination.pages}
              className="btn-secondary !py-1.5 !px-3 disabled:opacity-40"
            ><ChevronRight size={13} /></button>
          </div>
        </div>
      )}

      {/* ── Attachment popup ────────────────────────────────────── */}
      {attachPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setAttachPopup(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-dark-card border border-dark-border rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto z-10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-dark-border">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-mono font-bold text-white text-base">{attachPopup.symbol}</div>
                  <div className={cn(
                    'flex items-center gap-1.5 text-xs font-mono font-bold',
                    OC[tradeOutcome(attachPopup)].cls
                  )}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: OC[tradeOutcome(attachPopup)].dot }} />
                    {tradeOutcome(attachPopup)}
                  </div>
                </div>
                <div className="text-xs font-mono text-gray-400 mt-0.5">
                  {formatDate(attachPopup.entry_time, 'long')}
                </div>
              </div>
              <button onClick={() => setAttachPopup(null)} className="text-gray-500 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Trade info */}
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { label: 'P&L Net',  value: formatPnL(attachPopup.net_pnl),                  color: getPnLColor(attachPopup.net_pnl) },
                { label: 'Side',     value: attachPopup.side.toUpperCase(),                   color: attachPopup.side === 'long' ? 'text-[#00d17a]' : 'text-[#ff3b5c]' },
                { label: 'Px ent.',  value: fmtPrice(attachPopup.entry_price),                color: 'text-white' },
                { label: 'Px sort.', value: fmtPrice(attachPopup.exit_price),                 color: 'text-white' },
                { label: 'Quantité', value: String(toNum(attachPopup.quantity)),               color: 'text-white' },
                { label: 'Durée',    value: formatDuration(attachPopup.duration_seconds),      color: 'text-gray-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/4 rounded-lg px-3 py-2">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-0.5">{label}</div>
                  <div className={cn('text-xs font-mono font-semibold', color)}>{value}</div>
                </div>
              ))}
            </div>

            {/* Screenshots */}
            {((attachPopup as any).screenshots || []).length > 0 && (
              <div className="px-4 pb-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-2">
                  Charts joints ({((attachPopup as any).screenshots || []).length})
                </div>
                <div className="space-y-2">
                  {((attachPopup as any).screenshots as string[]).map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`chart-${i + 1}`}
                      className="w-full rounded-lg border border-dark-border object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </AppLayout>
  )
}
