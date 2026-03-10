'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { trades, accounts, Trade, Account, TradeFilters } from '@/lib/api'
import { formatPnL, formatDate, formatDuration, getPnLColor, cn, toNum } from '@/lib/utils'
import {
  Search, Plus, ChevronLeft, ChevronRight, Trash2, X,
  CheckSquare, Square, FileImage, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function tradeOutcome(t: Trade): 'WIN' | 'LOSS' | 'BE' | 'OPEN' {
  if (t.status === 'open') return 'OPEN'
  const pnl = toNum(t.net_pnl)
  if (pnl > 0) return 'WIN'
  if (pnl < 0) return 'LOSS'
  return 'BE'
}

const OC = {
  WIN:  { dot: '#00d17a', text: '#00d17a' },
  LOSS: { dot: '#ff3b5c', text: '#ff3b5c' },
  BE:   { dot: '#4f8ef7', text: '#4f8ef7' },
  OPEN: { dot: '#9ca3af', text: '#9ca3af' },
}

// Round-display price: integers for >=1, up to 8 sig digits for micro
function fmtPrice(v: any): string {
  const n = toNum(v)
  if (!n) return '—'
  if (n >= 100) return Math.round(n).toLocaleString()
  if (n >= 1)   return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return n.toPrecision(4).replace(/\.?0+$/, '')
}

function fmtAmt(v: number): string {
  if (!v) return '—'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

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
  const now = new Date()
  const tod = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ms  = (d: number) => new Date(d)
  const D   = 86_400_000
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
    default: return { from: ms(now.getTime() - 90 * D), to: now }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ring SVG
// ─────────────────────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 28 }: { pct: number; color: string; size?: number }) {
  const r    = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(150,150,150,0.15)" strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StatPill — horizontal: label · value · ring+%
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({
  label, value, pct, color,
}: {
  label: string; value: string | number; pct: number; color: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border hover:border-accent/30 transition-all group">
      <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors whitespace-nowrap w-14">
        {label}
      </span>
      <span className="font-mono font-bold text-sm w-12 text-right" style={{ color }}>{value}</span>
      <div className="flex items-center gap-1 ml-1">
        <Ring pct={pct} color={color} size={26} />
        <span className="text-[9px] font-mono w-7" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SideArrow
// ─────────────────────────────────────────────────────────────────────────────

function SideArrow({ side }: { side: 'long' | 'short' }) {
  const c = side === 'long' ? '#00d17a' : '#ff3b5c'
  return (
    <svg width={14} height={14} viewBox="0 0 14 14">
      {side === 'long'
        ? <polyline points="1,12 4.5,6.5 8.5,9 13,2" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        : <polyline points="1,2 4.5,7.5 8.5,5 13,12" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      }
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Slider
// ─────────────────────────────────────────────────────────────────────────────

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

  const markers = useMemo(() => {
    const seen = new Set<string>()
    const out: number[] = []
    tradeList.forEach(t => {
      const d   = new Date(t.entry_time)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!seen.has(key)) {
        seen.add(key)
        const pos = rangeMs > 0 ? (d.getTime() - baseMs) / rangeMs : 0.5
        if (pos >= 0 && pos <= 1) out.push(pos)
      }
    })
    return out
  }, [tradeList, baseMs, rangeMs])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const pos  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      if (dragRef.current === 'left')
        onRange(Math.min(pos, rRef.current - 0.02), rRef.current)
      else
        onRange(lRef.current, Math.max(pos, lRef.current + 0.02))
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
    <div className="px-1 py-0.5">
      <div ref={trackRef} className="relative h-6 select-none">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-light-border dark:bg-dark-border rounded-full" />
        <div className="absolute top-1/2 -translate-y-1/2 h-[3px] bg-accent/50 rounded-full transition-all"
          style={{ left: `${leftPos * 100}%`, width: `${(rightPos - leftPos) * 100}%` }} />
        {markers.map((pos, i) => (
          <div key={i} className="absolute top-1 bottom-1 w-[2px] rounded-full bg-accent/40 pointer-events-none"
            style={{ left: `${pos * 100}%` }} />
        ))}
        {/* Left handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-4 bg-accent rounded-sm cursor-ew-resize shadow z-10 hover:scale-110 transition-transform"
          style={{ left: `${leftPos * 100}%` }}
          onMouseDown={e => { e.preventDefault(); dragRef.current = 'left' }}
        />
        {/* Right handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-4 bg-accent rounded-sm cursor-ew-resize shadow z-10 hover:scale-110 transition-transform"
          style={{ left: `${rightPos * 100}%` }}
          onMouseDown={e => { e.preventDefault(); dragRef.current = 'right' }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-gray-500">{fmt(baseFrom)}</span>
        <span className="text-[9px] font-mono text-gray-500">{fmt(baseTo)}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Column definitions
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_SORT = new Set(['entry_time', 'exit_time', 'net_pnl', 'symbol'])

type ColDef = {
  id: string
  label: string
  sortKey: string | null // null = not sortable
  clientSort?: (a: Trade, b: Trade, dir: 1 | -1) => number
}
const COLS: ColDef[] = [
  {
    id: 'date', label: 'Date', sortKey: 'entry_time',
    clientSort: (a, b, d) => d * (new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()),
  },
  {
    id: 'symbol', label: 'Symbole', sortKey: 'symbol',
    clientSort: (a, b, d) => d * a.symbol.localeCompare(b.symbol),
  },
  { id: 'status', label: 'Statut', sortKey: 'status',
    clientSort: (a, b, d) => d * tradeOutcome(a).localeCompare(tradeOutcome(b)) },
  { id: 'side', label: 'Side', sortKey: 'side',
    clientSort: (a, b, d) => d * a.side.localeCompare(b.side) },
  { id: 'entry_price', label: 'Prix\nentrée', sortKey: 'entry_price',
    clientSort: (a, b, d) => d * (toNum(a.entry_price) - toNum(b.entry_price)) },
  { id: 'exit_price', label: 'Prix\nsortie', sortKey: 'exit_price',
    clientSort: (a, b, d) => d * (toNum(a.exit_price) - toNum(b.exit_price)) },
  { id: 'mnt_ent', label: 'Montant\nentrée', sortKey: 'mnt_ent',
    clientSort: (a, b, d) => d * (toNum(a.entry_price) * toNum(a.quantity) - toNum(b.entry_price) * toNum(b.quantity)) },
  { id: 'mnt_sort', label: 'Montant\nsortie', sortKey: 'mnt_sort',
    clientSort: (a, b, d) => d * (toNum(a.exit_price) * toNum(a.quantity) - toNum(b.exit_price) * toNum(b.quantity)) },
  { id: 'duration', label: 'Durée', sortKey: 'duration',
    clientSort: (a, b, d) => d * (toNum(a.duration_seconds) - toNum(b.duration_seconds)) },
  { id: 'net_pnl', label: 'Retour\n%', sortKey: 'net_pnl',
    clientSort: (a, b, d) => d * (toNum(a.net_pnl) - toNum(b.net_pnl)) },
  { id: 'attach', label: '', sortKey: null },
  { id: 'del',    label: '', sortKey: null },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

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

  // Sort: { col: ColDef.id, dir: 'asc'|'desc' }
  const [sortState, setSortState] = useState<{ col: string; dir: 'asc' | 'desc' }>({
    col: 'date', dir: 'desc',
  })

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

  // Auto base range from trade dates
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

  // Client-side sorted display list
  const displayList = useMemo(() => {
    const col  = COLS.find(c => c.id === sortState.col)
    if (!col?.clientSort || BACKEND_SORT.has(col.sortKey || '')) return tradeList
    const dir: 1 | -1 = sortState.dir === 'asc' ? 1 : -1
    return [...tradeList].sort((a, b) => col.clientSort!(a, b, dir))
  }, [tradeList, sortState])

  const setFilter = (key: keyof TradeFilters, value: any) =>
    setFilters(f => ({ ...f, [key]: value || undefined, page: 1 }))

  const handleSort = (col: ColDef) => {
    if (!col.sortKey) return
    const newDir = sortState.col === col.id && sortState.dir === 'desc' ? 'asc' : 'desc'
    setSortState({ col: col.id, dir: newDir })
    // If backend supports it, also filter-sort
    if (BACKEND_SORT.has(col.sortKey)) {
      setFilters(f => ({ ...f, sort: col.sortKey!, order: newDir, page: 1 }))
    }
  }

  const applyPreset = (id: string) => {
    const range = getPresetRange(id)
    setActivePreset(id)
    setBaseRange(range)
    setSliderL(0); setSliderR(1)
    setFilters(f => ({ ...f, date_from: range.from.toISOString(), date_to: range.to.toISOString(), page: 1 }))
  }

  const resetFilters = () => {
    setActivePreset(null); setBaseRange(null)
    setSliderL(0); setSliderR(1)
    setFilters({ page: 1, limit: 50, sort: 'entry_time', order: 'desc' })
    setSortState({ col: 'date', dir: 'desc' })
  }

  const handleSlider = useCallback((l: number, r: number) => {
    setSliderL(l); setSliderR(r); setActivePreset(null)
    const ms   = displayBaseRange.to.getTime() - displayBaseRange.from.getTime()
    const from = new Date(displayBaseRange.from.getTime() + l * ms)
    const to   = new Date(displayBaseRange.from.getTime() + r * ms)
    setFilters(f => ({ ...f, date_from: from.toISOString(), date_to: to.toISOString(), page: 1 }))
  }, [displayBaseRange])

  // Stats — always computed from full tradeList (not affected by display sort)
  const stats = useMemo(() => {
    const total   = tradeList.length || 1
    const closed  = tradeList.filter(t => t.status !== 'open').length
    const winsArr = tradeList.filter(t => toNum(t.net_pnl) > 0)
    const lossArr = tradeList.filter(t => toNum(t.net_pnl) < 0)
    const beArr   = tradeList.filter(t => t.status !== 'open' && toNum(t.net_pnl) === 0)
    const openArr = tradeList.filter(t => t.status === 'open')
    const avgW    = winsArr.length ? winsArr.reduce((s, t) => s + toNum(t.net_pnl), 0) / winsArr.length : 0
    const avgL    = lossArr.length ? lossArr.reduce((s, t) => s + toNum(t.net_pnl), 0) / lossArr.length : 0
    const netPnL  = tradeList.reduce((s, t) => s + toNum(t.net_pnl), 0)
    const wr      = closed > 0 ? (winsArr.length / closed) * 100 : 0
    return {
      total, closed,
      wins: winsArr.length, losses: lossArr.length, be: beArr.length, open: openArr.length,
      avgW, avgL, netPnL, wr,
    }
  }, [tradeList])

  // Equity curve — always chronological regardless of sort
  const equityData = useMemo(() => {
    const sorted = [...tradeList]
      .filter(t => t.status !== 'open')
      .sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
    let cum = 0
    return sorted.map(t => ({ v: (cum += toNum(t.net_pnl)) }))
  }, [tradeList])

  const pnlColor  = stats.netPnL >= 0 ? '#00d17a' : '#ff3b5c'

  // Selection
  const allIds      = tradeList.map(t => t.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
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
      setSelected(new Set<string>()); load()
    } catch (err: any) { alert(err.message) }
    finally { setDeletingBulk(false) }
  }

  // Sort icon component
  const SortIcon = ({ col }: { col: ColDef }) => {
    if (!col.sortKey) return null
    if (sortState.col !== col.id) return <ChevronsUpDown size={10} className="opacity-30 text-gray-400" />
    return sortState.dir === 'asc'
      ? <ChevronUp size={10} className="text-accent" />
      : <ChevronDown size={10} className="text-accent" />
  }

  // ── Header slot (presets + slider for desktop topbar) ──────────────────────
  const headerSlot = (
    <div className="flex items-center gap-2 h-full py-1">
      {/* Presets: flex-1, boutons étirés pour occuper la largeur */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          {PRESETS.slice(0, 5).map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              className={cn(
                'flex-1 px-1 py-0.5 rounded text-[10px] font-mono font-medium border transition-all text-center',
                activePreset === p.id
                  ? 'bg-accent text-white border-accent'
                  : 'text-gray-500 dark:text-gray-400 border-light-border dark:border-dark-border hover:border-accent hover:text-accent'
              )}>{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {PRESETS.slice(5).map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              className={cn(
                'flex-1 px-1 py-0.5 rounded text-[10px] font-mono font-medium border transition-all text-center',
                activePreset === p.id
                  ? 'bg-accent text-white border-accent'
                  : 'text-gray-500 dark:text-gray-400 border-light-border dark:border-dark-border hover:border-accent hover:text-accent'
              )}>{p.label}</button>
          ))}
          <button onClick={resetFilters}
            className="flex-1 px-1 py-0.5 rounded text-[10px] font-mono text-gray-400 border border-light-border dark:border-dark-border hover:text-loss hover:border-loss transition-all text-center">
            Reset
          </button>
        </div>
      </div>
      {/* Timeline réduite à ~200px */}
      <div className="flex-shrink-0 w-52">
        <TimelineSlider
          baseFrom={displayBaseRange.from} baseTo={displayBaseRange.to}
          tradeList={tradeList} leftPos={sliderL} rightPos={sliderR} onRange={handleSlider}
        />
      </div>
    </div>
  )

  return (
    <AppLayout title="Trades" headerSlot={headerSlot}>

      {/* ── Mobile: presets + slider ────────────────────────────── */}
      <div className="md:hidden card p-3 mb-3">
        <div className="flex flex-wrap gap-1 mb-3">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-mono font-medium border transition-all',
                activePreset === p.id
                  ? 'bg-accent text-white border-accent'
                  : 'text-gray-500 dark:text-gray-400 border-light-border dark:border-dark-border hover:border-accent hover:text-accent'
              )}>{p.label}</button>
          ))}
          <button onClick={resetFilters}
            className="px-2 py-1 rounded text-[11px] font-mono text-gray-400 border border-light-border dark:border-dark-border hover:text-loss hover:border-loss transition-all">
            Reset
          </button>
        </div>
        <TimelineSlider
          baseFrom={displayBaseRange.from} baseTo={displayBaseRange.to}
          tradeList={tradeList} leftPos={sliderL} rightPos={sliderR} onRange={handleSlider}
        />
      </div>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      {tradeList.length > 0 && (
        <div className="card mb-3 overflow-hidden">
          <div className="flex items-stretch gap-0 divide-x divide-light-border dark:divide-dark-border">

            {/* Equity chart */}
            <div className="flex-shrink-0 w-64 h-20 p-2">
              {equityData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <defs>
                      <linearGradient id="ecg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={pnlColor} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={pnlColor} stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="bg-dark-card border border-dark-border rounded px-2 py-1 text-[10px] font-mono" style={{ color: pnlColor }}>
                            {toNum(payload[0].value) >= 0 ? '+' : ''}{toNum(payload[0].value).toFixed(2)}
                          </div>
                        ) : null
                      }
                    />
                    <Area type="monotone" dataKey="v" stroke={pnlColor} strokeWidth={2}
                      fill="url(#ecg)" dot={false} animationDuration={800} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-gray-500">—</div>
              )}
            </div>

            {/* Stats grid 2x3 */}
            <div className="flex-1 grid grid-cols-3 grid-rows-2 divide-x divide-y divide-light-border dark:divide-dark-border">
              <StatPill label="Wins"   value={stats.wins}    pct={stats.total > 0 ? stats.wins   / stats.total * 100 : 0} color="#00d17a" />
              <StatPill label="Open"   value={stats.open}    pct={stats.total > 0 ? stats.open   / stats.total * 100 : 0} color="#9ca3af" />
              <StatPill label="Avg W"  value={stats.avgW ? `$${Math.round(stats.avgW)}` : '—'} pct={stats.wr} color="#00d17a" />
              <StatPill label="Losses" value={stats.losses}  pct={stats.total > 0 ? stats.losses / stats.total * 100 : 0} color="#ff3b5c" />
              <StatPill label="BE"     value={stats.be}      pct={stats.total > 0 ? stats.be     / stats.total * 100 : 0} color="#4f8ef7" />
              <StatPill label="Avg L"  value={stats.avgL ? `-$${Math.round(Math.abs(stats.avgL))}` : '—'} pct={stats.closed > 0 ? stats.losses / stats.closed * 100 : 0} color="#ff3b5c" />
            </div>

            {/* PnL box */}
            <div className={cn(
              'flex-shrink-0 w-44 flex flex-col items-center justify-center px-4 py-3',
              stats.netPnL >= 0 ? 'bg-[#00d17a]/5' : 'bg-[#ff3b5c]/5'
            )}>
              <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-1">P&L Net</div>
              <div className="font-mono font-bold text-base leading-tight" style={{ color: pnlColor }}>
                {formatPnL(stats.netPnL)}
              </div>
              <div className="mt-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                style={{ background: pnlColor + '25', color: pnlColor }}>
                {stats.wr.toFixed(1)}%
              </div>
              <div className="text-[9px] font-mono text-gray-500 mt-1">
                {stats.wins}W · {stats.losses}L
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Search bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Trade count */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 px-2.5 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
          <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{pagination.total}</span>
          <span className="text-xs font-mono text-gray-500">trades</span>
        </div>

        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="tl-input pl-8 text-xs w-full"
            placeholder="Symbole…"
            onChange={e => setFilter('symbol', e.target.value)}
          />
        </div>

        {accountList.length > 1 && (
          <select className="tl-select text-xs w-36 flex-shrink-0" onChange={e => setFilter('account_id', e.target.value)}>
            <option value="">Tous comptes</option>
            {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        <select className="tl-select text-xs w-20 flex-shrink-0" onChange={e => setFilter('side', e.target.value)}>
          <option value="">L / S</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>

        <Link href="/trades/new"
          className="btn-primary flex items-center gap-1.5 !px-3 !py-2 flex-shrink-0 !text-xs">
          <Plus size={13} /><span className="hidden sm:inline">Nouveau</span>
        </Link>
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-accent/10 border border-accent/30 rounded-lg mb-3 text-xs font-mono">
          <span className="text-accent font-semibold">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors">
              Tout désélect.
            </button>
            <button onClick={handleDeleteSelected} disabled={deletingBulk}
              className="flex items-center gap-1.5 text-loss hover:bg-loss/10 px-3 py-1.5 rounded border border-loss/30 transition-all">
              {deletingBulk
                ? <span className="w-3 h-3 border border-loss border-t-transparent rounded-full animate-spin" />
                : <Trash2 size={12} />}
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="card p-4 space-y-2">
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="skeleton h-10 rounded"
              style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : tradeList.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-mono text-gray-500 mb-4">Aucun trade trouvé</p>
          <Link href="/trades/new" className="btn-primary inline-flex items-center gap-2 text-xs">
            <Plus size={13} /> Nouveau trade
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-light-border dark:border-dark-border">
                  {/* Checkbox */}
                  <th className="px-2 py-2.5 w-7">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-accent transition-colors flex items-center">
                      {allSelected ? <CheckSquare size={12} className="text-accent" /> : <Square size={12} />}
                    </button>
                  </th>
                  {COLS.map(col => (
                    <th key={col.id}
                      className={cn(
                        'px-3 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest whitespace-nowrap select-none',
                        'text-gray-500 dark:text-gray-400',
                        col.id === 'attach' || col.id === 'del' ? 'w-7 px-1' : '',
                        col.sortKey ? 'cursor-pointer hover:text-accent transition-colors' : ''
                      )}
                      onClick={() => col.sortKey && handleSort(col)}
                    >
                      <div className="flex items-start gap-1">
                        <span className="leading-tight">
                          {col.label.includes('\n')
                            ? col.label.split('\n').map((part, i) => (
                                <span key={i} className="block">{part}</span>
                              ))
                            : col.label
                          }
                        </span>
                        <SortIcon col={col} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayList.map((trade, idx) => {
                  const outcome  = tradeOutcome(trade)
                  const oc       = OC[outcome]
                  const mntEnt   = toNum(trade.entry_price) * toNum(trade.quantity)
                  const mntSortV = trade.exit_price ? toNum(trade.exit_price) * toNum(trade.quantity) : null
                  const hasFiles = Array.isArray((trade as any).screenshots) && (trade as any).screenshots.length > 0
                  const isPopup  = attachPopup?.id === trade.id
                  const isSel    = selected.has(trade.id)

                  return (
                    <tr
                      key={trade.id}
                      className={cn(
                        'cursor-pointer transition-colors border-b border-light-border/40 dark:border-dark-border/40 last:border-0',
                        isSel
                          ? 'bg-accent/5'
                          : idx % 2 === 0
                            ? 'bg-transparent hover:bg-light-hover dark:hover:bg-dark-hover'
                            : 'bg-light-surface/30 dark:bg-dark-surface/30 hover:bg-light-hover dark:hover:bg-dark-hover'
                      )}
                      onClick={() => router.push(`/trades/${trade.id}`)}
                    >
                      {/* Checkbox */}
                      <td className="px-2 w-7" onClick={e => { e.stopPropagation(); toggleSelect(trade.id) }}>
                        <button className="text-gray-400 hover:text-accent transition-colors flex items-center">
                          {isSel ? <CheckSquare size={12} className="text-accent" /> : <Square size={12} />}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5">
                        <div className="font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">
                          {formatDate(trade.entry_time, 'short')}
                        </div>
                        <div className="font-mono text-gray-400 text-[9px] mt-0.5">
                          {new Date(trade.entry_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Symbol */}
                      <td className="px-3 py-2.5">
                        <div className="font-mono font-bold text-gray-900 dark:text-white">{trade.symbol}</div>
                        {trade.timeframe && (
                          <div className="font-mono text-gray-400 text-[9px] mt-0.5">{trade.timeframe}</div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: oc.dot }} />
                          <span className="font-mono font-bold" style={{ color: oc.text }}>{outcome}</span>
                        </div>
                      </td>

                      {/* Side — icon only */}
                      <td className="px-3 py-2.5">
                        <SideArrow side={trade.side} />
                      </td>

                      {/* Prix entrée */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-gray-700 dark:text-gray-200 whitespace-nowrap tabular-nums">
                          {fmtPrice(trade.entry_price)}
                        </span>
                      </td>

                      {/* Prix sortie */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-gray-600 dark:text-gray-300 whitespace-nowrap tabular-nums">
                          {trade.exit_price ? fmtPrice(trade.exit_price) : '—'}
                        </span>
                      </td>

                      {/* Montant entrée */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                          {mntEnt ? fmtAmt(mntEnt) : '—'}
                        </span>
                      </td>

                      {/* Montant sortie */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                          {mntSortV ? fmtAmt(mntSortV) : '—'}
                        </span>
                      </td>

                      {/* Durée */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-gray-500 whitespace-nowrap">
                          {formatDuration(trade.duration_seconds)}
                        </span>
                      </td>

                      {/* Retour % */}
                      <td className="px-3 py-2.5">
                        <span className={cn('font-mono font-bold whitespace-nowrap tabular-nums', getPnLColor(trade.net_pnl))}>
                          {formatPnL(trade.net_pnl)}
                        </span>
                        {trade.pnl_percent != null && toNum(trade.pnl_percent) !== 0 && (
                          <div className={cn('font-mono text-[9px] mt-0.5', getPnLColor(trade.pnl_percent))}>
                            {toNum(trade.pnl_percent) >= 0 ? '+' : ''}{toNum(trade.pnl_percent).toFixed(2)}%
                          </div>
                        )}
                      </td>

                      {/* Attachments */}
                      <td className="px-1 w-7">
                        {hasFiles ? (
                          <button
                            onClick={e => { e.stopPropagation(); setAttachPopup(isPopup ? null : trade) }}
                            className={cn(
                              'w-6 h-6 flex items-center justify-center rounded transition-all',
                              isPopup ? 'text-accent bg-accent/15' : 'text-gray-400 hover:text-accent hover:bg-accent/10'
                            )}
                          >
                            <FileImage size={11} />
                          </button>
                        ) : <span className="w-6 h-6 inline-flex" />}
                      </td>

                      {/* Delete */}
                      <td className="px-1 w-7">
                        <button
                          onClick={e => handleDelete(trade.id, e)}
                          disabled={deleting === trade.id}
                          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-loss hover:bg-loss/10 transition-all"
                        >
                          {deleting === trade.id
                            ? <span className="w-3 h-3 border border-loss border-t-transparent rounded-full animate-spin" />
                            : <Trash2 size={11} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setAttachPopup(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-dark-card border border-dark-border rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto z-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-4 border-b border-dark-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white text-base">{attachPopup.symbol}</span>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold"
                    style={{ color: OC[tradeOutcome(attachPopup)].text }}>
                    <div className="w-1.5 h-1.5 rounded-full"
                      style={{ background: OC[tradeOutcome(attachPopup)].dot }} />
                    {tradeOutcome(attachPopup)}
                  </div>
                </div>
                <div className="text-xs font-mono text-gray-400 mt-0.5">
                  {formatDate(attachPopup.entry_time, 'long')}
                </div>
              </div>
              <button onClick={() => setAttachPopup(null)}
                className="text-gray-500 hover:text-white transition-colors p-1">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { label: 'P&L Net',  value: formatPnL(attachPopup.net_pnl),             cls: getPnLColor(attachPopup.net_pnl) },
                { label: 'Side',     value: attachPopup.side.toUpperCase(),              cls: attachPopup.side === 'long' ? 'text-[#00d17a]' : 'text-[#ff3b5c]' },
                { label: 'Px ent.',  value: fmtPrice(attachPopup.entry_price),           cls: 'text-white' },
                { label: 'Px sort.', value: fmtPrice(attachPopup.exit_price),            cls: 'text-white' },
                { label: 'Qté',      value: String(toNum(attachPopup.quantity)),          cls: 'text-white' },
                { label: 'Durée',    value: formatDuration(attachPopup.duration_seconds), cls: 'text-gray-300' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-white/4 rounded-lg px-3 py-2">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-0.5">{label}</div>
                  <div className={cn('text-xs font-mono font-semibold', cls)}>{value}</div>
                </div>
              ))}
            </div>
            {((attachPopup as any).screenshots || []).length > 0 && (
              <div className="px-4 pb-4">
                <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-2">
                  Charts joints ({((attachPopup as any).screenshots as string[]).length})
                </div>
                <div className="space-y-2">
                  {((attachPopup as any).screenshots as string[]).map((src, i) => (
                    <img key={i} src={src} alt={`chart-${i + 1}`}
                      className="w-full rounded-lg border border-dark-border object-cover" />
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
