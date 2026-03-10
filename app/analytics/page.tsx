'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { analytics, accounts, Account } from '@/lib/api'
import { formatPnL, formatDuration, getPnLColor, cn, toNum } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Trophy, AlertTriangle, Activity, Target } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Overview {
  total_trades: number; open_trades: number
  winning_trades: number; losing_trades: number; breakeven_trades: number
  total_pnl: number; avg_pnl: number; best_trade: number; worst_trade: number
  total_fees: number; avg_r: number; win_rate: number; profit_factor: number
  avg_duration_seconds: number
}
interface EquityPoint  { date: string; daily_pnl: number; cumulative_pnl: number; trades_count: number; wins: number; losses: number }
interface SymbolStat   { symbol: string; trades: number; total_pnl: number; win_rate: number; avg_r: number }
interface SetupStat    { setup: string;  trades: number; total_pnl: number; win_rate: number }
interface SessionStat  { session: string; trades: number; total_pnl: number; win_rate: number }
interface MistakeStat  { mistake: string; occurrences: number; total_pnl_impact: number }
interface DrawdownPt   { date: string; cumulative_pnl: number; drawdown_pct: number }
interface CalendarDay  { date: string; pnl: number; trades_count: number; wins: number; losses: number }

const PERIODS = [
  { id: '7d', label: '7J' }, { id: '30d', label: '30J' },
  { id: '90d', label: '90J' }, { id: '1y', label: '1An' }, { id: 'all', label: 'Tout' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Micro components
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color = '#4f8ef7', trend,
}: {
  label: string; value: string; sub?: string
  icon: React.ReactNode; color?: string; trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="card p-4 flex items-start gap-3 hover:border-accent/30 transition-colors group">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
        style={{ background: color + '18', color }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500 mb-0.5">{label}</div>
        <div className="font-mono font-bold text-sm truncate" style={{ color }}>{value}</div>
        {sub && <div className="text-[10px] font-mono text-gray-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">
        {children}
      </h3>
      <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs font-mono text-gray-500">Pas de données</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom tooltip
// ─────────────────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg px-3 py-2 shadow-xl text-[10px] font-mono">
      {label && <div className="text-gray-500 mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color || p.fill }}>
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Win rate ring
// ─────────────────────────────────────────────────────────────────────────────

function WinRateRing({ pct }: { pct: number }) {
  const r = 22, circ = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ
  const color = pct >= 60 ? '#00d17a' : pct >= 45 ? '#f59e0b' : '#ff3b5c'
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg width={56} height={56} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(150,150,150,0.12)" strokeWidth={4} />
        <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="text-center">
        <div className="text-xs font-mono font-bold" style={{ color }}>{pct.toFixed(0)}%</div>
        <div className="text-[8px] font-mono text-gray-500 leading-tight">WR</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizontal bar (for symbol/setup tables)
// ─────────────────────────────────────────────────────────────────────────────

function HBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1 rounded-full bg-light-border dark:bg-dark-border overflow-hidden mt-1">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { isDark } = useTheme()

  const [accountList,  setAccountList]  = useState<Account[]>([])
  const [selAccount,   setSelAccount]   = useState<string | undefined>()
  const [period,       setPeriod]       = useState('30d')
  const [calMonth,     setCalMonth]     = useState(new Date())

  const [loading,      setLoading]      = useState(true)
  const [overview,     setOverview]     = useState<Overview | null>(null)
  const [equity,       setEquity]       = useState<EquityPoint[]>([])
  const [bySymbol,     setBySymbol]     = useState<SymbolStat[]>([])
  const [bySetup,      setBySetup]      = useState<SetupStat[]>([])
  const [bySession,    setBySession]    = useState<SessionStat[]>([])
  const [byMistakes,   setByMistakes]   = useState<MistakeStat[]>([])
  const [drawdown,     setDrawdown]     = useState<{ data: DrawdownPt[]; max: number }>({ data: [], max: 0 })
  const [calendar,     setCalendar]     = useState<CalendarDay[]>([])
  const [calLoading,   setCalLoading]   = useState(false)

  const gridColor = isDark ? '#1e2028' : '#e8e8e4'
  const axisColor = isDark ? '#4b5563' : '#9ca3af'

  // Load all analytics
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, eq, sym, setup, sess, mist, dd] = await Promise.all([
        analytics.overview(period, selAccount),
        analytics.equityCurve(selAccount),
        analytics.bySymbol(selAccount),
        analytics.bySetup(selAccount),
        analytics.bySession(selAccount),
        analytics.byMistakes(selAccount),
        analytics.drawdown(selAccount),
      ])
      setOverview(ov.overview)
      setEquity(eq.equity_curve)
      setBySymbol(sym.by_symbol)
      setBySetup(setup.by_setup)
      setBySession(sess.by_session)
      setByMistakes(mist.by_mistakes)
      setDrawdown({ data: dd.drawdown, max: dd.max_drawdown_pct })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [period, selAccount])

  // Load calendar separately (nav independent)
  const loadCalendar = useCallback(async () => {
    setCalLoading(true)
    try {
      const data = await analytics.calendar(calMonth.getFullYear(), calMonth.getMonth() + 1, selAccount)
      setCalendar(data.calendar)
    } catch (e) { console.error(e) }
    finally { setCalLoading(false) }
  }, [calMonth, selAccount])

  useEffect(() => { accounts.list().then(d => setAccountList(d.accounts)).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { loadCalendar() }, [loadCalendar])

  // Calendar grid
  const calGrid = useMemo(() => {
    const year  = calMonth.getFullYear()
    const month = calMonth.getMonth()
    const days  = new Date(year, month + 1, 0).getDate()
    const first = (new Date(year, month, 1).getDay() + 6) % 7 // Mon=0
    const map   = Object.fromEntries(calendar.map(d => [d.date?.toString().slice(0, 10), d]))
    const today = new Date().toISOString().slice(0, 10)
    return { year, month, days, first, map, today }
  }, [calMonth, calendar])

  const pnlColor = toNum(overview?.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c'

  // Equity with short date labels
  const equityDisplay = useMemo(() =>
    equity.map(e => ({ ...e, label: e.date ? new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '' }))
  , [equity])

  const maxAbsDaily = useMemo(() =>
    equity.reduce((m, e) => Math.max(m, Math.abs(toNum(e.daily_pnl))), 1)
  , [equity])

  if (loading && !overview) {
    return (
      <AppLayout title="Analytics">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
          {[1,2,3].map(i => <div key={i} className="skeleton h-56 rounded-xl" />)}
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Analytics">

      {/* ── Controls ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {/* Period */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={cn(
                'px-3 py-1 rounded text-[11px] font-mono font-medium transition-all',
                period === p.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-accent'
              )}>{p.label}</button>
          ))}
        </div>

        {/* Account */}
        {accountList.length > 1 && (
          <select
            className="tl-select text-xs w-44"
            value={selAccount || ''}
            onChange={e => setSelAccount(e.target.value || undefined)}
          >
            <option value="">Tous les comptes</option>
            {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        {loading && (
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin ml-1" />
        )}
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-5">
          <KpiCard label="P&L Net" icon={<Activity size={15} />}
            value={formatPnL(overview.total_pnl)}
            sub={`${toNum(overview.total_trades)} trades`}
            color={pnlColor} />
          <KpiCard label="Win Rate" icon={<Target size={15} />}
            value={`${toNum(overview.win_rate).toFixed(1)}%`}
            sub={`${overview.winning_trades}W / ${overview.losing_trades}L`}
            color={toNum(overview.win_rate) >= 50 ? '#00d17a' : '#f59e0b'} />
          <KpiCard label="Profit Factor" icon={<TrendingUp size={15} />}
            value={overview.profit_factor != null ? toNum(overview.profit_factor).toFixed(2) : '—'}
            sub="gains / pertes"
            color={toNum(overview.profit_factor) >= 1.5 ? '#00d17a' : toNum(overview.profit_factor) >= 1 ? '#f59e0b' : '#ff3b5c'} />
          <KpiCard label="Avg R" icon={<Activity size={15} />}
            value={overview.avg_r != null ? `${toNum(overview.avg_r) >= 0 ? '+' : ''}${toNum(overview.avg_r).toFixed(2)}R` : '—'}
            sub="par trade fermé"
            color={toNum(overview.avg_r) >= 0 ? '#00d17a' : '#ff3b5c'} />
          <KpiCard label="Best Trade" icon={<Trophy size={15} />}
            value={formatPnL(overview.best_trade)}
            color="#00d17a" />
          <KpiCard label="Worst Trade" icon={<TrendingDown size={15} />}
            value={formatPnL(overview.worst_trade)}
            color="#ff3b5c" />
          <KpiCard label="Frais totaux" icon={<AlertTriangle size={15} />}
            value={formatPnL(overview.total_fees)}
            sub="coût des frais"
            color="#f59e0b" />
          <KpiCard label="Durée moy." icon={<Activity size={15} />}
            value={formatDuration(overview.avg_duration_seconds)}
            sub="par trade"
            color="#4f8ef7" />
        </div>
      )}

      {/* ── Equity curve ──────────────────────────────────────────── */}
      <div className="mb-4">
        <SectionTitle>Equity Curve</SectionTitle>
        <div className="card p-4">
          {equity.length < 2 ? (
            <div className="h-52 flex items-center justify-center">
              <EmptyChart />
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={equityDisplay} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={pnlColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={pnlColor} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="label"
                    tick={{ fontSize: 9, fontFamily: 'monospace', fill: axisColor }}
                    axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(equity.length / 8) - 1)} />
                  <YAxis yAxisId="cum"
                    tick={{ fontSize: 9, fontFamily: 'monospace', fill: axisColor }}
                    axisLine={false} tickLine={false} width={52}
                    tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`} />
                  <YAxis yAxisId="daily" orientation="right"
                    tick={{ fontSize: 9, fontFamily: 'monospace', fill: axisColor }}
                    axisLine={false} tickLine={false} width={44}
                    domain={[-maxAbsDaily * 1.2, maxAbsDaily * 1.2]}
                    tickFormatter={v => v.toFixed(0)} />
                  <ReferenceLine yAxisId="cum" y={0} stroke={gridColor} strokeDasharray="4 4" />
                  <Tooltip
                    content={<ChartTooltip formatter={(v: number, name: string) =>
                      name === 'P&L jour' ? formatPnL(v) : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
                    } />}
                  />
                  {/* Daily bars */}
                  <Bar yAxisId="daily" dataKey="daily_pnl" name="P&L jour" maxBarSize={8} opacity={0.7}>
                    {equityDisplay.map((e, i) => (
                      <Cell key={i} fill={toNum(e.daily_pnl) >= 0 ? '#00d17a' : '#ff3b5c'} />
                    ))}
                  </Bar>
                  {/* Cumulative line */}
                  <Area yAxisId="cum" type="monotone" dataKey="cumulative_pnl" name="Cumulé"
                    stroke={pnlColor} strokeWidth={2} fill="url(#eqGrad)" dot={false}
                    animationDuration={1000} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Drawdown + Win Rate ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Drawdown — 2/3 */}
        <div className="md:col-span-2">
          <SectionTitle>Drawdown {drawdown.max !== 0 && `— Max ${Math.abs(toNum(drawdown.max)).toFixed(2)}%`}</SectionTitle>
          <div className="card p-4 h-44">
            {drawdown.data.length < 2 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdown.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ff3b5c" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ff3b5c" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="date"
                    tick={{ fontSize: 8, fontFamily: 'monospace', fill: axisColor }}
                    axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(drawdown.data.length / 6) - 1)}
                    tickFormatter={d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''} />
                  <YAxis tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 9, fontFamily: 'monospace', fill: axisColor }}
                    axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toFixed(2)}%`} />} />
                  <Area type="monotone" dataKey="drawdown_pct" name="Drawdown"
                    stroke="#ff3b5c" strokeWidth={1.5} fill="url(#ddGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Win Rate summary — 1/3 */}
        <div>
          <SectionTitle>Répartition</SectionTitle>
          <div className="card p-4 h-44 flex flex-col justify-between">
            {overview ? (
              <>
                <div className="flex items-center justify-between">
                  <WinRateRing pct={toNum(overview.win_rate)} />
                  <div className="text-right">
                    <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Trades</div>
                    <div className="font-mono font-bold text-base text-gray-900 dark:text-white mt-0.5">{overview.total_trades}</div>
                  </div>
                </div>
                <div className="space-y-1.5 mt-2">
                  {[
                    { label: 'Gagnants', val: overview.winning_trades,  color: '#00d17a' },
                    { label: 'Perdants', val: overview.losing_trades,   color: '#ff3b5c' },
                    { label: 'Break-even', val: overview.breakeven_trades, color: '#4f8ef7' },
                  ].map(row => {
                    const pct = overview.total_trades > 0 ? (row.val / overview.total_trades) * 100 : 0
                    return (
                      <div key={row.label}>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono text-gray-500">{row.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-semibold" style={{ color: row.color }}>{row.val}</span>
                            <span className="text-[9px] font-mono text-gray-500">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <HBar pct={pct} color={row.color} />
                      </div>
                    )
                  })}
                </div>
              </>
            ) : <EmptyChart />}
          </div>
        </div>
      </div>

      {/* ── By Symbol + By Setup ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* By Symbol */}
        <div>
          <SectionTitle>Performance par Symbole</SectionTitle>
          <div className="card overflow-hidden">
            {bySymbol.length === 0 ? (
              <div className="p-6"><EmptyChart /></div>
            ) : (
              <>
                <div className="p-3" style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySymbol.slice(0, 8)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="symbol"
                        tick={{ fontSize: 8, fontFamily: 'monospace', fill: axisColor }}
                        axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: axisColor }}
                        axisLine={false} tickLine={false} width={44}
                        tickFormatter={v => `${v >= 0 ? '' : ''}${v.toFixed(0)}`} />
                      <Tooltip content={<ChartTooltip formatter={(v: number) => formatPnL(v)} />} />
                      <Bar dataKey="total_pnl" name="P&L" maxBarSize={20} radius={[2, 2, 0, 0]}>
                        {bySymbol.slice(0, 8).map((e, i) => (
                          <Cell key={i} fill={toNum(e.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c'} opacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="border-t border-light-border dark:border-dark-border">
                  {bySymbol.slice(0, 6).map((s, i) => (
                    <div key={s.symbol}
                      className="flex items-center gap-3 px-3 py-2 border-b border-light-border/40 dark:border-dark-border/40 last:border-0 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors">
                      <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold text-gray-500 bg-light-surface dark:bg-dark-surface flex-shrink-0">
                        {i + 1}
                      </div>
                      <span className="font-mono font-bold text-xs text-gray-900 dark:text-white w-20 truncate">{s.symbol}</span>
                      <span className="text-[10px] font-mono text-gray-500 w-6 flex-shrink-0">{s.trades}T</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-mono text-gray-500">WR</span>
                          <span className="text-[9px] font-mono" style={{ color: toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b' }}>
                            {toNum(s.win_rate).toFixed(0)}%
                          </span>
                        </div>
                        <HBar pct={toNum(s.win_rate)} color={toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b'} />
                      </div>
                      <span className={cn('font-mono font-bold text-xs w-20 text-right flex-shrink-0', getPnLColor(s.total_pnl))}>
                        {formatPnL(s.total_pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* By Setup */}
        <div>
          <SectionTitle>Performance par Setup</SectionTitle>
          <div className="card overflow-hidden">
            {bySetup.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs font-mono text-gray-500 mb-1">Aucun setup tagué</p>
                <p className="text-[10px] font-mono text-gray-400">Ajoute des setup_tags sur tes trades</p>
              </div>
            ) : (
              <>
                <div className="p-3" style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySetup.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 60, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                      <XAxis type="number"
                        tick={{ fontSize: 9, fontFamily: 'monospace', fill: axisColor }}
                        axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}`} />
                      <YAxis type="category" dataKey="setup" width={70}
                        tick={{ fontSize: 8, fontFamily: 'monospace', fill: axisColor }}
                        axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip formatter={(v: number) => formatPnL(v)} />} />
                      <Bar dataKey="total_pnl" name="P&L" maxBarSize={14} radius={[0, 2, 2, 0]}>
                        {bySetup.slice(0, 8).map((s, i) => (
                          <Cell key={i} fill={toNum(s.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c'} opacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="border-t border-light-border dark:border-dark-border">
                  {bySetup.slice(0, 5).map((s, i) => (
                    <div key={s.setup}
                      className="flex items-center gap-3 px-3 py-2 border-b border-light-border/40 dark:border-dark-border/40 last:border-0 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors">
                      <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold text-gray-500 bg-light-surface dark:bg-dark-surface flex-shrink-0">{i + 1}</div>
                      <span className="font-mono text-xs text-gray-800 dark:text-gray-200 flex-1 truncate">{s.setup}</span>
                      <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">{s.trades}T</span>
                      <span className="text-[10px] font-mono flex-shrink-0" style={{ color: toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b' }}>
                        {toNum(s.win_rate).toFixed(0)}%
                      </span>
                      <span className={cn('font-mono font-bold text-xs w-20 text-right flex-shrink-0', getPnLColor(s.total_pnl))}>
                        {formatPnL(s.total_pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── By Session + Mistakes ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* By Session */}
        <div>
          <SectionTitle>Performance par Session</SectionTitle>
          <div className="card overflow-hidden">
            {bySession.length === 0 ? (
              <div className="p-6"><EmptyChart /></div>
            ) : (
              <>
                <div className="p-3" style={{ height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySession} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="session"
                        tick={{ fontSize: 9, fontFamily: 'monospace', fill: axisColor }}
                        axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: axisColor }}
                        axisLine={false} tickLine={false} width={44}
                        tickFormatter={v => v.toFixed(0)} />
                      <Tooltip content={<ChartTooltip formatter={(v: number) => formatPnL(v)} />} />
                      <Bar dataKey="total_pnl" name="P&L" maxBarSize={36} radius={[3, 3, 0, 0]}>
                        {bySession.map((s, i) => (
                          <Cell key={i} fill={toNum(s.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c'} opacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="border-t border-light-border dark:border-dark-border">
                  {bySession.map(s => (
                    <div key={s.session}
                      className="flex items-center gap-3 px-3 py-2 border-b border-light-border/40 dark:border-dark-border/40 last:border-0">
                      <span className="font-mono text-xs capitalize text-gray-800 dark:text-gray-200 w-20 flex-shrink-0">{s.session || 'N/A'}</span>
                      <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">{s.trades}T</span>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-[9px] font-mono text-gray-500">WR</span>
                          <span className="text-[9px] font-mono" style={{ color: toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b' }}>
                            {toNum(s.win_rate).toFixed(0)}%
                          </span>
                        </div>
                        <HBar pct={toNum(s.win_rate)} color={toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b'} />
                      </div>
                      <span className={cn('font-mono font-bold text-xs w-20 text-right flex-shrink-0', getPnLColor(s.total_pnl))}>
                        {formatPnL(s.total_pnl)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mistakes */}
        <div>
          <SectionTitle>Erreurs Récurrentes</SectionTitle>
          <div className="card p-4">
            {byMistakes.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-xs font-mono text-profit font-semibold">Aucune erreur tagguée</p>
                <p className="text-[10px] font-mono text-gray-500 mt-1">Continue comme ça !</p>
              </div>
            ) : (
              <div className="space-y-3">
                {byMistakes.slice(0, 7).map((m, i) => {
                  const pct = byMistakes[0]?.occurrences > 0
                    ? (m.occurrences / byMistakes[0].occurrences) * 100 : 0
                  return (
                    <div key={m.mistake} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold text-gray-500 bg-light-surface dark:bg-dark-surface flex-shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-gray-700 dark:text-gray-300 truncate">{m.mistake}</span>
                          <span className="text-[10px] font-mono text-gray-500 ml-2 flex-shrink-0">{m.occurrences}×</span>
                        </div>
                        <HBar pct={pct} color="#ff3b5c" />
                      </div>
                      <span className={cn('text-[10px] font-mono w-16 text-right flex-shrink-0 font-semibold', getPnLColor(m.total_pnl_impact))}>
                        {formatPnL(m.total_pnl_impact)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Calendar heatmap ──────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Calendrier P&L</SectionTitle>
          <div className="flex items-center gap-1 -mt-3">
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-accent hover:bg-accent/10 transition-all">
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-mono text-gray-600 dark:text-gray-400 capitalize w-28 text-center">
              {calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-accent hover:bg-accent/10 transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="card p-4">
          {calLoading ? (
            <div className="skeleton h-36 rounded-lg" />
          ) : (
            <>
              {/* Day headers Mon–Sun */}
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
                  <div key={d} className="text-center text-[9px] font-mono text-gray-400 py-0.5">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for alignment */}
                {Array.from({ length: calGrid.first }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: calGrid.days }).map((_, i) => {
                  const day     = i + 1
                  const dateStr = `${calGrid.year}-${String(calGrid.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const data    = calGrid.map[dateStr]
                  const isToday = dateStr === calGrid.today
                  const pnl     = data ? toNum(data.pnl) : null
                  const pos     = pnl !== null && pnl > 0
                  const neg     = pnl !== null && pnl < 0
                  return (
                    <div key={day}
                      title={data ? `${data.trades_count} trades | ${formatPnL(data.pnl)}` : String(day)}
                      className={cn(
                        'aspect-square rounded flex flex-col items-center justify-center transition-all cursor-default',
                        'text-[9px] md:text-[10px]',
                        pos  ? 'bg-profit/20 hover:bg-profit/30' :
                        neg  ? 'bg-loss/20 hover:bg-loss/30' :
                               'bg-light-hover dark:bg-dark-hover hover:bg-light-border dark:hover:bg-dark-border',
                        isToday && 'ring-1 ring-accent ring-offset-1 ring-offset-transparent'
                      )}
                    >
                      <span className={cn(
                        'font-mono leading-none font-medium',
                        pos ? 'text-profit' : neg ? 'text-loss' : 'text-gray-500 dark:text-gray-400'
                      )}>{day}</span>
                      {data && (
                        <span className={cn(
                          'font-mono font-bold leading-none mt-0.5 hidden sm:block text-[8px]',
                          pos ? 'text-profit' : 'text-loss'
                        )}>
                          {pnl! >= 0 ? '+' : ''}{pnl!.toFixed(0)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Calendar legend */}
              {calendar.length > 0 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-light-border dark:border-dark-border">
                  <div className="flex items-center gap-4 text-[9px] font-mono text-gray-500">
                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-profit/25" /> Gagnant</span>
                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-loss/25" /> Perdant</span>
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-mono">
                    <span className="text-profit">{calendar.filter(d => toNum(d.pnl) > 0).length}J+</span>
                    <span className="text-loss">{calendar.filter(d => toNum(d.pnl) < 0).length}J-</span>
                    <span className="text-gray-500">{calendar.reduce((s, d) => s + (d.trades_count || 0), 0)} trades</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </AppLayout>
  )
}
