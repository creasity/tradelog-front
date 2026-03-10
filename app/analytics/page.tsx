'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { analytics, accounts, Account, Analytics } from '@/lib/api'
import { formatPnL, formatDuration, getPnLColor, cn, toNum } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'
import { ChevronLeft, ChevronRight, Sparkles, RefreshCw } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Overview   = Analytics
interface EP    { date: string; daily_pnl: number; cumulative_pnl: number; trades_count: number }
interface SymSt { symbol: string; trades: number; total_pnl: number; avg_pnl: number; win_rate: number; avg_r: number }
interface SetSt { setup: string; trades: number; total_pnl: number; win_rate: number }
interface SesSt { session: string; trades: number; total_pnl: number; win_rate: number }
interface MistSt { mistake: string; occurrences: number; total_pnl_impact: number }
interface DdPt  { date: string; cumulative_pnl: number; drawdown_pct: number }
interface CalDay { date: string; pnl: number; trades_count: number; wins: number; losses: number }
interface WdSt  { day: string; dow: number; trades: number; total_pnl: number; avg_pnl: number; win_rate: number }
interface HrSt  { hour: number; label: string; trades: number; total_pnl: number; avg_pnl: number; win_rate: number }

const PERIODS = [
  { id: '7d', label: '7J' }, { id: '30d', label: '30J' },
  { id: '90d', label: '90J' }, { id: '1y', label: '1An' }, { id: 'all', label: 'Tout' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Micro components
// ─────────────────────────────────────────────────────────────────────────────

// KPI card — icon on top, compact
function Kpi({ label, value, sub, color = '#4f8ef7', icon }: {
  label: string; value: string; sub?: string; color?: string; icon: string
}) {
  return (
    <div className="card p-3 flex flex-col gap-1.5 hover:border-accent/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-lg leading-none">{icon}</span>
        {sub && <span className="text-[9px] font-mono text-gray-500 text-right leading-tight max-w-[60%] truncate">{sub}</span>}
      </div>
      <div className="font-mono font-bold text-sm leading-none truncate" style={{ color }}>{value}</div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-gray-500 leading-none">{label}</div>
    </div>
  )
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.15em] text-gray-500 font-semibold whitespace-nowrap">{children}</h3>
      <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />
      {right}
    </div>
  )
}

function Empty() {
  return <div className="flex items-center justify-center h-full py-8 text-xs font-mono text-gray-500">Pas de données</div>
}

function HBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-0.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden mt-0.5">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

// Custom recharts tooltip
function CT({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg px-2.5 py-2 shadow-xl text-[10px] font-mono">
      {label && <div className="text-gray-500 mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="font-bold" style={{ color: p.color || p.fill }}>
            {fmt ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { isDark } = useTheme()

  const [accounts_,   setAccounts]   = useState<Account[]>([])
  const [selAcc,      setSelAcc]     = useState<string | undefined>()
  const [period,      setPeriod]     = useState('30d')
  const [calMonth,    setCalMonth]   = useState(new Date())

  const [loading,     setLoading]    = useState(true)
  const [calLoading,  setCalLoading] = useState(false)
  const [aiLoading,   setAiLoading]  = useState(false)

  const [ov,          setOv]         = useState<Overview | null>(null)
  const [equity,      setEquity]     = useState<EP[]>([])
  const [bySymbol,    setBySymbol]   = useState<SymSt[]>([])
  const [bySetup,     setBySetup]    = useState<SetSt[]>([])
  const [bySession,   setBySession]  = useState<SesSt[]>([])
  const [byMistakes,  setByMistakes] = useState<MistSt[]>([])
  const [dd,          setDd]         = useState<{ data: DdPt[]; max: number }>({ data: [], max: 0 })
  const [calendar,    setCalendar]   = useState<CalDay[]>([])
  const [byWeekday,   setByWeekday]  = useState<WdSt[]>([])
  const [byHour,      setByHour]     = useState<HrSt[]>([])
  const [aiAnalysis,  setAiAnalysis] = useState<string>('')

  const gc = isDark ? '#1e2028' : '#e8e8e4'
  const ac = isDark ? '#4b5563' : '#9ca3af'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, eq, sym, setup, sess, mist, drawdown, wd, hr] = await Promise.all([
        analytics.overview(period, selAcc),
        analytics.equityCurve(selAcc),
        analytics.bySymbol(selAcc),
        analytics.bySetup(selAcc),
        analytics.bySession(selAcc),
        analytics.byMistakes(selAcc),
        analytics.drawdown(selAcc),
        analytics.byWeekday(selAcc),
        analytics.byHour(selAcc),
      ])
      setOv(o.overview)
      setEquity(eq.equity_curve)
      setBySymbol(sym.by_symbol)
      setBySetup(setup.by_setup)
      setBySession(sess.by_session)
      setByMistakes(mist.by_mistakes)
      setDd({ data: drawdown.drawdown, max: drawdown.max_drawdown_pct })
      setByWeekday(wd.by_weekday)
      setByHour(hr.by_hour)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [period, selAcc])

  const loadCal = useCallback(async () => {
    setCalLoading(true)
    try {
      const d = await analytics.calendar(calMonth.getFullYear(), calMonth.getMonth() + 1, selAcc)
      setCalendar(d.calendar)
    } catch (e) { console.error(e) }
    finally { setCalLoading(false) }
  }, [calMonth, selAcc])

  useEffect(() => { accounts.list().then(d => setAccounts(d.accounts)).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { loadCal() }, [loadCal])

  // AI analysis
  const generateAiAnalysis = async () => {
    if (!ov) return
    setAiLoading(true)
    setAiAnalysis('')
    try {
      const prompt = `Tu es un coach de trading professionnel. Voici les statistiques de trading d'un trader sur la période "${period}":

- P&L Net: ${formatPnL(ov.total_pnl)}
- Win Rate: ${toNum(ov.win_rate).toFixed(1)}%
- Profit Factor: ${ov.profit_factor ? toNum(ov.profit_factor).toFixed(2) : 'N/A'}
- Trades totaux: ${ov.total_trades} (${ov.winning_trades}W / ${ov.losing_trades}L)
- Avg R: ${ov.avg_r ? toNum(ov.avg_r).toFixed(2) : 'N/A'}
- Meilleur trade: ${formatPnL(ov.best_trade)}
- Pire trade: ${formatPnL(ov.worst_trade)}
- Frais totaux: ${formatPnL(ov.total_fees)}
- Max drawdown: ${Math.abs(toNum(dd.max)).toFixed(2)}%
${bySymbol.length > 0 ? `- Meilleur symbole: ${bySymbol[0].symbol} (${formatPnL(bySymbol[0].total_pnl)})` : ''}
${byMistakes.length > 0 ? `- Erreur principale: ${byMistakes[0].mistake} (${byMistakes[0].occurrences}x)` : ''}
${byWeekday.filter(d => d.trades > 0).length > 0 ? `- Meilleur jour: ${byWeekday.filter(d => d.trades > 0).sort((a,b) => b.total_pnl - a.total_pnl)[0]?.day}` : ''}

Fournis une analyse concise en 3-4 paragraphes courts:
1. **Synthèse** : points forts et faibles
2. **Risques** : ce qui doit être corrigé en priorité  
3. **Opportunités** : ce qui fonctionne bien à exploiter
4. **Actions** : 2-3 actions concrètes à prendre

Sois direct, précis, bienveillant. Réponds en français.`

      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiAnalysis(data.analysis || '')
      } else {
        setAiAnalysis('Erreur lors de la génération de l\'analyse. Vérifiez la configuration API.')
      }
    } catch (e) {
      setAiAnalysis('Erreur de connexion à l\'API d\'analyse.')
    }
    setAiLoading(false)
  }

  // Derived
  const pnlColor   = toNum(ov?.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c'
  const totalAbsPnl = useMemo(() => bySymbol.reduce((s, r) => s + Math.abs(toNum(r.total_pnl)), 0), [bySymbol])
  const equityFmt  = useMemo(() =>
    equity.map(e => ({
      ...e,
      label: e.date ? new Date(e.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) : '',
    })), [equity])
  const maxAbsDaily = useMemo(() => equity.reduce((m, e) => Math.max(m, Math.abs(toNum(e.daily_pnl))), 1), [equity])

  // Calendar grid
  const calGrid = useMemo(() => {
    const y = calMonth.getFullYear(), mo = calMonth.getMonth()
    const days = new Date(y, mo + 1, 0).getDate()
    const first = (new Date(y, mo, 1).getDay() + 6) % 7
    const map = Object.fromEntries(calendar.map(d => [d.date?.toString().slice(0, 10), d]))
    return { y, mo, days, first, map, today: new Date().toISOString().slice(0, 10) }
  }, [calMonth, calendar])

  if (loading && !ov) return (
    <AppLayout title="Analytics">
      <div className="space-y-4">
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {Array(8).fill(0).map((_,i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
        {[200, 180, 150].map((h,i) => <div key={i} className="skeleton rounded-xl" style={{ height: h }} />)}
      </div>
    </AppLayout>
  )

  return (
    <AppLayout title="Analytics">

      {/* ── Controls ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={cn('px-3 py-1 rounded text-[11px] font-mono font-medium transition-all',
                period === p.id ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:text-accent'
              )}>{p.label}</button>
          ))}
        </div>
        {accounts_.length > 1 && (
          <select className="tl-select text-xs w-44" value={selAcc || ''}
            onChange={e => setSelAcc(e.target.value || undefined)}>
            <option value="">Tous les comptes</option>
            {accounts_.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        {loading && <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
      </div>

      {/* ── KPI grid — icon on top, 4+4 cols ──────────────────────── */}
      {ov && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
          <Kpi icon="💰" label="P&L Net"       value={formatPnL(ov.total_pnl)}
            sub={`${toNum(ov.total_trades)} trades`} color={pnlColor} />
          <Kpi icon="🎯" label="Win Rate"
            value={`${toNum(ov.win_rate).toFixed(1)}%`}
            sub={`${ov.winning_trades}W / ${ov.losing_trades}L`}
            color={toNum(ov.win_rate) >= 50 ? '#00d17a' : '#f59e0b'} />
          <Kpi icon="⚡" label="Profit Factor"
            value={ov.profit_factor != null ? toNum(ov.profit_factor).toFixed(2) : '—'}
            sub={toNum(ov.profit_factor) >= 2 ? 'Excellent' : toNum(ov.profit_factor) >= 1.5 ? 'Bon' : toNum(ov.profit_factor) >= 1 ? 'Seuil' : 'Négatif'}
            color={toNum(ov.profit_factor) >= 1.5 ? '#00d17a' : toNum(ov.profit_factor) >= 1 ? '#f59e0b' : '#ff3b5c'} />
          <Kpi icon="📐" label="Avg R"
            value={ov.avg_r != null ? `${toNum(ov.avg_r) >= 0 ? '+' : ''}${toNum(ov.avg_r).toFixed(2)}R` : '—'}
            sub="par trade"
            color={toNum(ov.avg_r) >= 1 ? '#00d17a' : toNum(ov.avg_r) >= 0 ? '#f59e0b' : '#ff3b5c'} />
          <Kpi icon="🏆" label="Best Trade"    value={formatPnL(ov.best_trade)}   color="#00d17a" />
          <Kpi icon="💀" label="Worst Trade"   value={formatPnL(ov.worst_trade)}  color="#ff3b5c" />
          <Kpi icon="💸" label="Frais"
            value={formatPnL(ov.total_fees)}
            sub={`${ov.total_trades > 0 ? (toNum(ov.total_fees) / toNum(ov.total_trades) * -1).toFixed(2) : '0'}$/trade`}
            color="#f59e0b" />
          <Kpi icon="⏱" label="Durée moy."
            value={formatDuration(ov.avg_duration_seconds)}
            sub={`${ov.open_trades} ouverts`}
            color="#4f8ef7" />
        </div>
      )}

      {/* ── Equity curve ──────────────────────────────────────────── */}
      <div className="mb-4">
        <SectionTitle>Equity Curve</SectionTitle>
        <div className="card p-4">
          {equity.length < 2 ? <div className="h-52"><Empty /></div> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={equityFmt} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={pnlColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={pnlColor} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gc} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(equity.length / 8) - 1)} />
                  <YAxis yAxisId="c" tick={{ fontSize: 9, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false} width={52}
                    tickFormatter={v => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(0)}`} />
                  <YAxis yAxisId="d" orientation="right"
                    tick={{ fontSize: 9, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false} width={40}
                    domain={[-maxAbsDaily * 1.3, maxAbsDaily * 1.3]}
                    tickFormatter={v => Number(v).toFixed(0)} />
                  <ReferenceLine yAxisId="c" y={0} stroke={gc} strokeDasharray="4 4" />
                  <Tooltip content={<CT fmt={(v: number) => formatPnL(v)} />} />
                  <Bar yAxisId="d" dataKey="daily_pnl" maxBarSize={8} opacity={0.65}>
                    {equityFmt.map((e, i) => <Cell key={i} fill={toNum(e.daily_pnl) >= 0 ? '#00d17a' : '#ff3b5c'} />)}
                  </Bar>
                  <Area yAxisId="c" type="monotone" dataKey="cumulative_pnl" stroke={pnlColor}
                    strokeWidth={2} fill="url(#eqG)" dot={false} animationDuration={800} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Drawdown + Win Rate pie ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2">
          <SectionTitle>Drawdown {dd.max !== 0 && `— Max ${Math.abs(toNum(dd.max)).toFixed(2)}%`}</SectionTitle>
          <div className="card p-4 h-44">
            {dd.data.length < 2 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dd.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ddG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ff3b5c" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ff3b5c" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gc} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(dd.data.length / 6) - 1)}
                    tickFormatter={d => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) : ''} />
                  <YAxis tickFormatter={v => `${Number(v).toFixed(0)}%`}
                    tick={{ fontSize: 9, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<CT fmt={(v: number) => `${Number(v).toFixed(2)}%`} />} />
                  <Area type="monotone" dataKey="drawdown_pct" stroke="#ff3b5c" strokeWidth={1.5}
                    fill="url(#ddG)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <SectionTitle>Répartition</SectionTitle>
          <div className="card p-4 h-44">
            {ov ? (
              <div className="h-full flex flex-col justify-between">
                <div className="text-center mb-3">
                  <div className="font-mono font-bold text-2xl" style={{ color: toNum(ov.win_rate) >= 50 ? '#00d17a' : '#f59e0b' }}>
                    {toNum(ov.win_rate).toFixed(1)}%
                  </div>
                  <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Win Rate</div>
                </div>
                {[
                  { l: 'Gagnants',  v: ov.winning_trades,  c: '#00d17a' },
                  { l: 'Perdants',  v: ov.losing_trades,   c: '#ff3b5c' },
                  { l: 'Break-even',v: ov.breakeven_trades, c: '#4f8ef7' },
                ].map(r => {
                  const p = toNum(ov.total_trades) > 0 ? (r.v / toNum(ov.total_trades)) * 100 : 0
                  return (
                    <div key={r.l}>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-gray-500">{r.l}</span>
                        <div className="flex gap-2">
                          <span className="text-[10px] font-mono font-bold" style={{ color: r.c }}>{r.v}</span>
                          <span className="text-[9px] font-mono text-gray-500 w-7 text-right">{p.toFixed(0)}%</span>
                        </div>
                      </div>
                      <HBar pct={p} color={r.c} />
                    </div>
                  )
                })}
              </div>
            ) : <Empty />}
          </div>
        </div>
      </div>

      {/* ── Performance par jour + heure ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* By weekday */}
        <div>
          <SectionTitle>Performance par Jour</SectionTitle>
          <div className="card p-4 h-48">
            {byWeekday.every(d => d.trades === 0) ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byWeekday} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gc} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false} width={44}
                    tickFormatter={v => Number(v).toFixed(0)} />
                  <Tooltip content={
                    <CT fmt={(v: number) => formatPnL(v)} />
                  } />
                  <Bar dataKey="total_pnl" maxBarSize={32} radius={[3, 3, 0, 0]}>
                    {byWeekday.map((d, i) => (
                      <Cell key={i}
                        fill={d.trades === 0 ? (isDark ? '#2a2d35' : '#e8e8e4') : toNum(d.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c'}
                        opacity={d.trades === 0 ? 0.4 : 0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* By hour */}
        <div>
          <SectionTitle>Performance par Heure</SectionTitle>
          <div className="card p-4 h-48">
            {byHour.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byHour} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gc} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 8, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(byHour.length / 6) - 1)} />
                  <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: ac }}
                    axisLine={false} tickLine={false} width={44}
                    tickFormatter={v => Number(v).toFixed(0)} />
                  <Tooltip content={<CT fmt={(v: number) => formatPnL(v)} />} />
                  <Bar dataKey="total_pnl" maxBarSize={14} radius={[2, 2, 0, 0]}>
                    {byHour.map((h, i) => (
                      <Cell key={i} fill={toNum(h.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c'} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Symbol table ──────────────────────────────────────────── */}
      <div className="mb-4">
        <SectionTitle>Performance par Symbole</SectionTitle>
        <div className="card overflow-hidden">
          {bySymbol.length === 0 ? <div className="p-6"><Empty /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">
                    {['#', 'Symbole', 'Trades', 'WR %', 'PnL', 'PnL %', 'Contribution', 'Avg R'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[9px] font-mono uppercase tracking-widest text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bySymbol.map((s, i) => {
                    const totalEntryPnl = bySymbol.reduce((sum, x) => sum + Math.abs(toNum(x.total_pnl)), 0) || 1
                    const pnlPct = toNum(s.avg_pnl) // already avg % per trade from the field? No, it's avg_pnl in $
                    // PnL% = avg_pnl / estimated avg entry (we don't have this directly, show avg_pnl instead)
                    const contrib = totalAbsPnl > 0 ? (Math.abs(toNum(s.total_pnl)) / totalAbsPnl * 100) : 0
                    const contribSigned = toNum(s.total_pnl) >= 0 ? contrib : -contrib
                    return (
                      <tr key={s.symbol}
                        className="border-b border-light-border/40 dark:border-dark-border/40 last:border-0 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="w-5 h-5 inline-flex items-center justify-center rounded text-[9px] font-mono text-gray-500 bg-light-surface dark:bg-dark-surface">{i + 1}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">{s.symbol}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{s.trades}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold"
                              style={{ color: toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b' }}>
                              {toNum(s.win_rate).toFixed(0)}%
                            </span>
                            <div className="w-10 h-0.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: `${toNum(s.win_rate)}%`, background: toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b' }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('font-mono font-bold text-xs', getPnLColor(s.total_pnl))}>{formatPnL(s.total_pnl)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('font-mono text-xs', getPnLColor(s.avg_pnl))}>
                            {toNum(s.avg_pnl) >= 0 ? '+' : ''}{formatPnL(s.avg_pnl)}/trade
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('font-mono text-xs font-semibold', contribSigned >= 0 ? 'text-profit' : 'text-loss')}>
                              {contribSigned >= 0 ? '+' : ''}{contrib.toFixed(1)}%
                            </span>
                            <div className="w-12 h-0.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: `${contrib}%`, background: contribSigned >= 0 ? '#00d17a' : '#ff3b5c' }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('font-mono text-xs', getPnLColor(s.avg_r))}>
                            {s.avg_r != null ? `${toNum(s.avg_r) >= 0 ? '+' : ''}${toNum(s.avg_r).toFixed(2)}R` : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Setup table ───────────────────────────────────────────── */}
      <div className="mb-4">
        <SectionTitle>Performance par Setup</SectionTitle>
        <div className="card overflow-hidden">
          {bySetup.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs font-mono text-gray-500">Aucun setup tagué</p>
              <p className="text-[10px] font-mono text-gray-400 mt-1">Ajoute des setup_tags sur tes trades pour voir les statistiques</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface">
                    {['#', 'Setup', 'Trades', 'WR %', 'PnL', 'Avg PnL', 'Contribution'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[9px] font-mono uppercase tracking-widest text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bySetup.map((s, i) => {
                    const totalSetupPnl = bySetup.reduce((sum, x) => sum + Math.abs(toNum(x.total_pnl)), 0) || 1
                    const contrib = totalSetupPnl > 0 ? (Math.abs(toNum(s.total_pnl)) / totalSetupPnl * 100) : 0
                    return (
                      <tr key={s.setup}
                        className="border-b border-light-border/40 dark:border-dark-border/40 last:border-0 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors">
                        <td className="px-3 py-2.5">
                          <span className="w-5 h-5 inline-flex items-center justify-center rounded text-[9px] font-mono text-gray-500 bg-light-surface dark:bg-dark-surface">{i + 1}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{s.setup}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{s.trades}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs font-semibold"
                            style={{ color: toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b' }}>
                            {toNum(s.win_rate).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('font-mono font-bold text-xs', getPnLColor(s.total_pnl))}>{formatPnL(s.total_pnl)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('font-mono text-xs', getPnLColor(s.total_pnl / s.trades))}>
                            {toNum(s.total_pnl) >= 0 ? '+' : ''}{formatPnL(toNum(s.total_pnl) / s.trades)}/trade
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('font-mono text-xs', toNum(s.total_pnl) >= 0 ? 'text-profit' : 'text-loss')}>
                              {contrib.toFixed(1)}%
                            </span>
                            <div className="w-12 h-0.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: `${contrib}%`, background: toNum(s.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c' }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Session + Mistakes ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* By session */}
        <div>
          <SectionTitle>Par Session</SectionTitle>
          <div className="card overflow-hidden">
            {bySession.length === 0 ? <div className="p-6"><Empty /></div> : (
              <>
                <div className="p-3 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySession} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gc} vertical={false} />
                      <XAxis dataKey="session" tick={{ fontSize: 9, fontFamily: 'monospace', fill: ac }}
                        axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: ac }}
                        axisLine={false} tickLine={false} width={44}
                        tickFormatter={v => Number(v).toFixed(0)} />
                      <Tooltip content={<CT fmt={(v: number) => formatPnL(v)} />} />
                      <Bar dataKey="total_pnl" maxBarSize={36} radius={[3, 3, 0, 0]}>
                        {bySession.map((s, i) => <Cell key={i} fill={toNum(s.total_pnl) >= 0 ? '#00d17a' : '#ff3b5c'} opacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="border-t border-light-border dark:border-dark-border">
                  {bySession.map(s => (
                    <div key={s.session} className="flex items-center gap-3 px-3 py-2 border-b border-light-border/40 dark:border-dark-border/40 last:border-0">
                      <span className="font-mono text-xs capitalize text-gray-700 dark:text-gray-300 w-20 flex-shrink-0">{s.session || 'N/A'}</span>
                      <span className="text-[10px] font-mono text-gray-500">{s.trades}T</span>
                      <div className="flex-1">
                        <HBar pct={toNum(s.win_rate)} color={toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b'} />
                      </div>
                      <span className="text-[9px] font-mono" style={{ color: toNum(s.win_rate) >= 50 ? '#00d17a' : '#f59e0b' }}>
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

        {/* Mistakes */}
        <div>
          <SectionTitle>Erreurs Récurrentes</SectionTitle>
          <div className="card p-4">
            {byMistakes.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-xs font-mono text-profit font-semibold">Aucune erreur</p>
              </div>
            ) : (
              <div className="space-y-3">
                {byMistakes.slice(0, 7).map((m, i) => {
                  const pct = byMistakes[0]?.occurrences > 0 ? (m.occurrences / byMistakes[0].occurrences) * 100 : 0
                  return (
                    <div key={m.mistake} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold text-gray-500 bg-light-surface dark:bg-dark-surface flex-shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
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

      {/* ── Calendrier ────────────────────────────────────────────── */}
      <div className="mb-4">
        <SectionTitle right={
          <div className="flex items-center gap-1">
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-accent hover:bg-accent/10 transition-all">
              <ChevronLeft size={13} />
            </button>
            <span className="text-[10px] font-mono text-gray-500 capitalize w-28 text-center">
              {calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-accent hover:bg-accent/10 transition-all">
              <ChevronRight size={13} />
            </button>
          </div>
        }>Calendrier P&L</SectionTitle>
        <div className="card p-4">
          {calLoading ? <div className="skeleton h-36 rounded-lg" /> : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
                  <div key={d} className="text-center text-[9px] font-mono text-gray-400">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: calGrid.first }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: calGrid.days }).map((_, i) => {
                  const day = i + 1
                  const ds  = `${calGrid.y}-${String(calGrid.mo + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const d   = calGrid.map[ds]
                  const p   = d ? toNum(d.pnl) : null
                  return (
                    <div key={day} title={d ? `${d.trades_count} trades | ${formatPnL(d.pnl)}` : String(day)}
                      className={cn(
                        'aspect-square rounded flex flex-col items-center justify-center text-[9px] md:text-[10px] cursor-default',
                        p !== null && p > 0  ? 'bg-profit/20 hover:bg-profit/30' :
                        p !== null && p < 0  ? 'bg-loss/20 hover:bg-loss/30' :
                                               'bg-light-hover dark:bg-dark-hover',
                        ds === calGrid.today && 'ring-1 ring-accent'
                      )}>
                      <span className={cn('font-mono leading-none font-medium',
                        p !== null && p > 0 ? 'text-profit' : p !== null && p < 0 ? 'text-loss' : 'text-gray-500 dark:text-gray-400'
                      )}>{day}</span>
                      {d && (
                        <span className={cn('font-mono font-bold leading-none mt-0.5 hidden sm:block text-[8px]', p! >= 0 ? 'text-profit' : 'text-loss')}>
                          {p! >= 0 ? '+' : ''}{Number(p).toFixed(0)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {calendar.length > 0 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-light-border dark:border-dark-border text-[9px] font-mono">
                  <div className="flex gap-4 text-gray-500">
                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-profit/25" />Gagnant</span>
                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-loss/25" />Perdant</span>
                  </div>
                  <div className="flex gap-4">
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

      {/* ── AI Analysis ───────────────────────────────────────────── */}
      <div className="mb-4">
        <SectionTitle>Analyse IA</SectionTitle>
        <div className="card p-4">
          {!aiAnalysis && !aiLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Sparkles size={22} className="text-accent" />
              </div>
              <div className="text-center">
                <p className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200 mb-1">Analyse personnalisée</p>
                <p className="text-xs font-mono text-gray-500 max-w-xs">
                  Génère une analyse approfondie de tes performances avec recommandations concrètes
                </p>
              </div>
              <button onClick={generateAiAnalysis} disabled={!ov}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-mono font-semibold hover:bg-accent/90 transition-all disabled:opacity-40">
                <Sparkles size={13} />
                Analyser mes performances
              </button>
            </div>
          ) : aiLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono text-gray-500">Analyse en cours...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {aiAnalysis.split('\n').filter(Boolean).map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-mono font-bold text-xs text-gray-900 dark:text-white mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>
                  }
                  if (line.match(/^\d\.\s\*\*/)) {
                    const parts = line.replace(/^\d\.\s/, '').split('**').filter(Boolean)
                    return (
                      <p key={i} className="font-mono text-xs text-gray-700 dark:text-gray-300 mb-1">
                        <span className="font-bold text-gray-900 dark:text-white">{parts[0]}</span>
                        {parts[1]}
                      </p>
                    )
                  }
                  return <p key={i} className="font-mono text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-1">{line}</p>
                })}
              </div>
              <div className="flex justify-end pt-2 border-t border-light-border dark:border-dark-border">
                <button onClick={generateAiAnalysis}
                  className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 hover:text-accent transition-colors">
                  <RefreshCw size={11} />
                  Regénérer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </AppLayout>
  )
}
