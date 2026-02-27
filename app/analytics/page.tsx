'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { analytics, accounts, Account } from '@/lib/api'
import { formatPnL, formatPercent, cn, getPnLColor } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'

interface SymbolStat { symbol: string; trades: number; total_pnl: number; win_rate: number; avg_r: number }
interface SessionStat { session: string; trades: number; total_pnl: number; win_rate: number }
interface MistakeStat { mistake: string; occurrences: number; total_pnl_impact: number }
interface DrawdownPoint { date: string; cumulative_pnl: number; drawdown_pct: number }

function ChartCard({ title, children, loading }: { title: string; children: React.ReactNode; loading?: boolean }) {
  return (
    <div className="card p-5">
      <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-900 dark:text-white mb-4">{title}</h3>
      {loading ? <div className="skeleton h-48 rounded-lg" /> : children}
    </div>
  )
}

function CustomBar({ x, y, width, height, value }: any) {
  const color = value >= 0 ? '#00d17a' : '#ff3b5c'
  return <rect x={x} y={y} width={width} height={Math.abs(height)} fill={color} opacity={0.85} rx={2} />
}

export default function AnalyticsPage() {
  const { isDark } = useTheme()
  const [accountList, setAccountList] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>()
  const [loading, setLoading] = useState(true)

  const [bySymbol, setBySymbol] = useState<SymbolStat[]>([])
  const [bySession, setBySession] = useState<SessionStat[]>([])
  const [byMistakes, setByMistakes] = useState<MistakeStat[]>([])
  const [drawdown, setDrawdown] = useState<{ data: DrawdownPoint[]; max: number }>({ data: [], max: 0 })
  const [calendar, setCalendar] = useState<Array<{ date: string; pnl: number; trades_count: number }>>([])

  const gridColor = isDark ? '#1e2028' : '#e5e5e0'
  const textColor = isDark ? '#6b7280' : '#9ca3af'

  const load = async () => {
    setLoading(true)
    try {
      const [sym, sess, mist, dd, cal] = await Promise.all([
        analytics.bySymbol(selectedAccount),
        analytics.bySession(selectedAccount),
        analytics.byMistakes(selectedAccount),
        analytics.drawdown(selectedAccount),
        analytics.calendar(new Date().getFullYear(), new Date().getMonth() + 1, selectedAccount),
      ])
      setBySymbol(sym.by_symbol)
      setBySession(sess.by_session)
      setByMistakes(mist.by_mistakes)
      setDrawdown({ data: dd.drawdown, max: dd.max_drawdown_pct })
      setCalendar(cal.calendar)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    accounts.list().then(d => setAccountList(d.accounts))
  }, [])

  useEffect(() => { load() }, [selectedAccount])

  // Build calendar grid
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const calMap = Object.fromEntries(calendar.map(d => [d.date.slice(0, 10), d]))

  return (
    <AppLayout title="Analytics" subtitle="Performance détaillée">
      {/* Account selector */}
      <div className="flex items-center gap-3 mb-6">
        <select
          className="tl-select w-48"
          value={selectedAccount || ''}
          onChange={e => setSelectedAccount(e.target.value || undefined)}
        >
          <option value="">Tous les comptes</option>
          {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span className="text-xs text-gray-400 font-mono">
          {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* P&L par symbole */}
        <ChartCard title="P&L par Symbole" loading={loading}>
          {bySymbol.length === 0 ? (
            <p className="text-center text-gray-400 text-sm font-mono py-12">Pas de données</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bySymbol.slice(0, 8)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="symbol" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: textColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: textColor }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    formatter={(v: number) => [formatPnL(v), 'P&L']}
                    contentStyle={{ background: isDark ? '#161820' : '#fff', border: `1px solid ${isDark ? '#1e2028' : '#e5e5e0'}`, borderRadius: 8, fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  />
                  <Bar dataKey="total_pnl" shape={<CustomBar />} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                {bySymbol.map(s => (
                  <div key={s.symbol} className="flex items-center justify-between text-xs font-mono py-1 border-b border-light-border/50 dark:border-dark-border/50 last:border-0">
                    <span className="font-semibold text-gray-800 dark:text-gray-200 w-24">{s.symbol}</span>
                    <span className="text-gray-400 w-12">{s.trades}T</span>
                    <span className="text-gray-400 w-14">{s.win_rate}% WR</span>
                    <span className={cn('font-semibold w-20 text-right', getPnLColor(s.total_pnl))}>{formatPnL(s.total_pnl)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* P&L par Session */}
        <ChartCard title="P&L par Session" loading={loading}>
          {bySession.length === 0 ? (
            <p className="text-center text-gray-400 text-sm font-mono py-12">Pas de données</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bySession} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="session" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: textColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: textColor }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    formatter={(v: number) => [formatPnL(v), 'P&L']}
                    contentStyle={{ background: isDark ? '#161820' : '#fff', border: `1px solid ${isDark ? '#1e2028' : '#e5e5e0'}`, borderRadius: 8, fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  />
                  <Bar dataKey="total_pnl" shape={<CustomBar />} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {bySession.map(s => (
                  <div key={s.session} className="flex items-center justify-between text-xs font-mono py-1 border-b border-light-border/50 dark:border-dark-border/50 last:border-0">
                    <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize w-20">{s.session}</span>
                    <span className="text-gray-400 w-12">{s.trades}T</span>
                    <span className="text-gray-400 w-14">{s.win_rate}% WR</span>
                    <span className={cn('font-semibold w-20 text-right', getPnLColor(s.total_pnl))}>{formatPnL(s.total_pnl)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Drawdown */}
        <ChartCard title={`Drawdown ${drawdown.max ? `(Max: ${drawdown.max.toFixed(2)}%)` : ''}`} loading={loading}>
          {drawdown.data.length === 0 ? (
            <p className="text-center text-gray-400 text-sm font-mono py-12">Pas de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={drawdown.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff3b5c" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ff3b5c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: textColor }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: textColor }} axisLine={false} tickLine={false} width={45} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(2)}%`, 'Drawdown']}
                  contentStyle={{ background: isDark ? '#161820' : '#fff', border: `1px solid ${isDark ? '#1e2028' : '#e5e5e0'}`, borderRadius: 8, fontSize: 12, fontFamily: 'JetBrains Mono' }}
                />
                <Area type="monotone" dataKey="drawdown_pct" stroke="#ff3b5c" strokeWidth={1.5} fill="url(#ddGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Erreurs récurrentes */}
        <ChartCard title="Erreurs Récurrentes" loading={loading}>
          {byMistakes.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-profit text-sm font-mono">✓ Aucune erreur identifiée</p>
              <p className="text-xs text-gray-400 mt-1">Continue comme ça !</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
              {byMistakes.map(m => (
                <div key={m.mistake} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{m.mistake}</span>
                      <span className="text-xs font-mono text-gray-400 ml-2 flex-shrink-0">{m.occurrences}x</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-light-border dark:bg-dark-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-loss"
                        style={{ width: `${Math.min(100, (m.occurrences / (byMistakes[0]?.occurrences || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className={cn('text-xs font-mono w-16 text-right flex-shrink-0', getPnLColor(m.total_pnl_impact))}>
                    {formatPnL(m.total_pnl_impact)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        {/* P&L Calendar */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-900 dark:text-white mb-4">
            Calendrier P&L — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h3>
          {loading ? <div className="skeleton h-40 rounded-lg" /> : (
            <div>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(d => (
                  <div key={d} className="text-center text-[10px] font-mono text-gray-400 py-1">{d}</div>
                ))}
              </div>
              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const data = calMap[dateStr]
                  const isToday = day === now.getDate()
                  return (
                    <div
                      key={day}
                      className={cn(
                        'rounded-md aspect-square flex flex-col items-center justify-center text-xs relative',
                        data
                          ? data.pnl > 0
                            ? 'bg-profit/20 text-profit'
                            : 'bg-loss/20 text-loss'
                          : 'bg-light-hover dark:bg-dark-hover text-gray-400',
                        isToday && 'ring-1 ring-accent'
                      )}
                      title={data ? `${data.trades_count} trades | P&L: ${formatPnL(data.pnl)}` : ''}
                    >
                      <span className="font-mono text-[10px] leading-none">{day}</span>
                      {data && (
                        <span className="font-mono text-[9px] leading-none mt-0.5 font-semibold">
                          {data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(0)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
