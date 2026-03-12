'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell
} from 'recharts'
import {
  Users, TrendingUp, Zap, Activity, ShieldCheck,
  ChevronUp, ChevronDown, Search, RefreshCw,
  UserCheck, UserX, BarChart2, Euro, ArrowUpRight,
  MoreHorizontal, LogOut, Ban, CheckCircle
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(n) }
function fmtEur(n: number) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) }
function fmtDate(s: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function relativeDate(s: string) {
  if (!s) return 'jamais'
  const diff = Date.now() - new Date(s).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "aujourd'hui"
  if (d === 1) return 'hier'
  if (d < 7) return `il y a ${d}j`
  if (d < 30) return `il y a ${Math.floor(d / 7)}sem`
  return fmtDate(s)
}

const PLAN_COLORS: Record<string, string> = { free: '#6b7280', pro: '#4f8ef7', algo: '#00d17a' }
const PLAN_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro', algo: 'Algo' }

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, delta, color = 'accent' }: {
  icon: any, label: string, value: string | number, sub?: string,
  delta?: { value: number, label: string }, color?: string
}) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-accent/10')}>
          <Icon size={15} className="text-accent" />
        </div>
        {delta !== undefined && (
          <span className={cn('text-[10px] font-mono flex items-center gap-0.5',
            delta.value >= 0 ? 'text-profit' : 'text-loss')}>
            {delta.value >= 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {Math.abs(delta.value)} {delta.label}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-display font-800 text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-[11px] font-mono text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const PLAN_BG: Record<string, string> = {
  free: 'bg-gray-500/10 text-gray-400',
  pro:  'bg-accent/10 text-accent',
  algo: 'bg-profit/10 text-profit',
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={cn('text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full', PLAN_BG[plan] || PLAN_BG.free)}>
      {PLAN_LABELS[plan] || plan}
    </span>
  )
}

function CustomTooltip({ active, payload, label, unit = '' }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-surface border border-white/5 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-white font-700">{unit}{fmt(payload[0].value)}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 })
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [userMenuId, setUserMenuId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // Guard: redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !(user as any).is_admin)) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const r = await fetch(`${API}/admin/stats`, { headers })
      const d = await r.json()
      setStats(d)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  const fetchUsers = useCallback(async (page = 1) => {
    setLoadingUsers(true)
    try {
      const params = new URLSearchParams({
        page: String(page), limit: '25', sort: sortField, order: sortOrder,
        ...(search ? { search } : {}),
        ...(planFilter ? { plan: planFilter } : {}),
      })
      const r = await fetch(`${API}/admin/users?${params}`, { headers })
      const d = await r.json()
      setUsers(d.users || [])
      setPagination(d.pagination || { total: 0, page: 1, pages: 1 })
    } finally {
      setLoadingUsers(false)
    }
  }, [search, planFilter, sortField, sortOrder])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── User actions ─────────────────────────────────────────────────
  const updateUser = async (id: string, data: any) => {
    setActionLoading(id)
    try {
      await fetch(`${API}/admin/users/${id}`, {
        method: 'PATCH', headers, body: JSON.stringify(data)
      })
      await fetchUsers(pagination.page)
    } finally {
      setActionLoading(null)
      setUserMenuId(null)
    }
  }

  const revokeSessions = async (id: string) => {
    setActionLoading(id)
    try {
      await fetch(`${API}/admin/users/${id}/sessions`, { method: 'DELETE', headers })
    } finally {
      setActionLoading(null)
      setUserMenuId(null)
    }
  }

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('desc') }
  }

  if (loading || !user || !(user as any).is_admin) return null

  // Fill chart data with zeros for missing days
  const fillDays = (data: { date: string, count: number }[], days = 30) => {
    const map = Object.fromEntries(data.map(r => [r.date?.toString().slice(0, 10), r.count]))
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
      const key = d.toISOString().slice(0, 10)
      return { date: d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }), count: map[key] || 0 }
    })
  }

  const signupData = stats ? fillDays(stats.charts?.signups || []) : []
  const tradesData = stats ? fillDays(stats.charts?.trades  || []) : []

  return (
    <AppLayout title="Admin" subtitle="Dashboard administrateur">
      <div className="space-y-6">

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <KpiCard icon={Users}      label="Users total"  value={loadingStats ? '…' : fmt(stats?.users?.total || 0)}
            sub={`${stats?.users?.active || 0} actifs`} delta={{ value: stats?.users?.new_7d || 0, label: 'cette sem.' }} />
          <KpiCard icon={Euro}       label="MRR"          value={loadingStats ? '…' : fmtEur(stats?.revenue?.mrr || 0)}
            sub={`ARR ${fmtEur(stats?.revenue?.arr || 0)}`} />
          <KpiCard icon={TrendingUp} label="Pro"          value={loadingStats ? '…' : fmt(stats?.users?.pro || 0)}
            sub={`${fmtEur((stats?.users?.pro || 0) * 15)}/mois`} />
          <KpiCard icon={Zap}        label="Algo"         value={loadingStats ? '…' : fmt(stats?.users?.algo || 0)}
            sub={`${fmtEur((stats?.users?.algo || 0) * 29)}/mois`} />
          <KpiCard icon={Activity}   label="Actifs 7j"    value={loadingStats ? '…' : fmt(stats?.users?.active_7d || 0)}
            sub={`30j: ${stats?.users?.active_30d || 0}`} />
          <KpiCard icon={BarChart2}  label="Trades total" value={loadingStats ? '…' : fmt(stats?.trades?.total || 0)}
            sub={`7j: ${stats?.trades?.last_7d || 0}`} />
          <KpiCard icon={UserCheck}  label="Nvx users 7j" value={loadingStats ? '…' : fmt(stats?.users?.new_7d || 0)}
            sub={`30j: ${stats?.users?.new_30d || 0}`} />
          <KpiCard icon={ShieldCheck} label="Free"        value={loadingStats ? '…' : fmt(stats?.users?.free || 0)}
            sub="Plan gratuit" />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Signups 30j */}
          <div className="card p-4 md:col-span-1">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Inscriptions 30j</p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={signupData}>
                <defs>
                  <linearGradient id="gSignup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f8ef7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4f8ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} interval={6} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" stroke="#4f8ef7" strokeWidth={2}
                  fill="url(#gSignup)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Trades 30j */}
          <div className="card p-4 md:col-span-1">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Trades journalisés 30j</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={tradesData} barSize={6}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280', fontFamily: 'monospace' }}
                  tickLine={false} axisLine={false} interval={6} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#00d17a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Plan distribution */}
          <div className="card p-4">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Répartition plans</p>
            <div className="space-y-3 mt-2">
              {(stats?.charts?.plans || [{ plan: 'free', count: 0 }, { plan: 'pro', count: 0 }, { plan: 'algo', count: 0 }]).map((p: any) => {
                const total = stats?.users?.total || 1
                const pct = Math.round((p.count / total) * 100)
                return (
                  <div key={p.plan}>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span style={{ color: PLAN_COLORS[p.plan] }}>{PLAN_LABELS[p.plan]}</span>
                      <span className="text-gray-400">{p.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: PLAN_COLORS[p.plan] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Users table ── */}
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-white/5">
            <div>
              <h2 className="font-display font-700 text-sm uppercase tracking-wider text-gray-900 dark:text-white">
                Utilisateurs
              </h2>
              <p className="text-xs font-mono text-gray-500 mt-0.5">{fmt(pagination.total)} au total</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-56">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="tl-input pl-7 h-8 text-xs"
                  placeholder="Email, prénom…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {/* Plan filter */}
              <select
                className="tl-input h-8 text-xs w-24"
                value={planFilter}
                onChange={e => setPlanFilter(e.target.value)}
              >
                <option value="">Tous</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="algo">Algo</option>
              </select>
              {/* Refresh */}
              <button onClick={() => { fetchStats(); fetchUsers() }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-all">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-white/5">
                  {[
                    { key: 'email',        label: 'Email' },
                    { key: 'plan',         label: 'Plan' },
                    { key: 'created_at',   label: 'Inscrit' },
                    { key: 'last_login_at',label: 'Dernière connexion' },
                    { key: 'trade_count',  label: 'Trades' },
                    { key: null,           label: 'Statut' },
                    { key: null,           label: '' },
                  ].map(({ key, label }) => (
                    <th key={label}
                      className={cn(
                        'px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-500 font-600',
                        key && 'cursor-pointer hover:text-gray-300 transition-colors select-none'
                      )}
                      onClick={() => key && handleSort(key)}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {key && sortField === key && (
                          sortOrder === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-600">Chargement…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-600">Aucun utilisateur trouvé</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-gray-200">{u.email}</p>
                        {(u.first_name || u.last_name) && (
                          <p className="text-[10px] text-gray-500 mt-0.5">{[u.first_name, u.last_name].filter(Boolean).join(' ')}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                    <td className="px-4 py-3 text-gray-400">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-gray-400">{relativeDate(u.last_login_at)}</td>
                    <td className="px-4 py-3 text-gray-300">{fmt(Number(u.trade_count || 0))}</td>
                    <td className="px-4 py-3">
                      {u.is_active
                        ? <span className="flex items-center gap-1 text-profit"><CheckCircle size={10} />Actif</span>
                        : <span className="flex items-center gap-1 text-loss"><Ban size={10} />Suspendu</span>
                      }
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={() => setUserMenuId(userMenuId === u.id ? null : u.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
                      >
                        {actionLoading === u.id
                          ? <span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                          : <MoreHorizontal size={13} />
                        }
                      </button>

                      {/* Context menu */}
                      {userMenuId === u.id && (
                        <div className="absolute right-8 top-2 z-20 bg-dark-surface border border-white/10 rounded-xl shadow-2xl py-1 w-48"
                          onMouseLeave={() => setUserMenuId(null)}>
                          {/* Plan upgrades */}
                          {['free', 'pro', 'algo'].filter(p => p !== u.plan).map(p => (
                            <button key={p} onClick={() => updateUser(u.id, { plan: p })}
                              className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/5 transition-colors flex items-center gap-2">
                              <ArrowUpRight size={11} style={{ color: PLAN_COLORS[p] }} />
                              Passer en <span style={{ color: PLAN_COLORS[p] }}>{PLAN_LABELS[p]}</span>
                            </button>
                          ))}
                          <div className="border-t border-white/5 my-1" />
                          {/* Suspend / Activate */}
                          <button onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                            className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/5 transition-colors flex items-center gap-2 text-gray-400">
                            {u.is_active
                              ? <><UserX size={11} className="text-loss" />Suspendre</>
                              : <><UserCheck size={11} className="text-profit" />Réactiver</>
                            }
                          </button>
                          {/* Revoke sessions */}
                          <button onClick={() => revokeSessions(u.id)}
                            className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/5 transition-colors flex items-center gap-2 text-gray-400">
                            <LogOut size={11} />Déconnecter partout
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/5">
              <p className="text-[11px] font-mono text-gray-500">
                Page {pagination.page} / {pagination.pages} — {fmt(pagination.total)} users
              </p>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => fetchUsers(p)}
                    className={cn(
                      'w-7 h-7 text-[11px] font-mono rounded-lg transition-all',
                      p === pagination.page
                        ? 'bg-accent text-white'
                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    )}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}
