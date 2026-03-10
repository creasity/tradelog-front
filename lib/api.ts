const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

// ── Token storage (localStorage) ─────────────────────────────────
const storage = {
  get: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  },
  set: (key: string, value: string) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, value)
  },
  remove: (key: string) => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(key)
  },
}

// ── Types ─────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  plan: 'free' | 'pro' | 'algo'
  trades_this_month?: number
  ai_queries_this_month?: number
}

export interface Account {
  id: string
  name: string
  broker: string
  asset_class: string
  currency: string
  initial_balance?: number
  current_balance?: number
  has_api_key?: boolean
  sync_enabled?: boolean
  total_trades?: number
  total_pnl?: number
  open_trades?: number
  is_default?: boolean
  last_sync_at?: string
  sync_config?: { symbols?: string; category?: string }
  notes?: string
  is_active?: boolean
  created_at?: string
}

export interface Trade {
  id: string
  account_id: string
  account_name?: string
  symbol: string
  side: 'long' | 'short'
  asset_class: string
  entry_price: number
  exit_price?: number
  quantity: number
  leverage?: number
  entry_time: string
  exit_time?: string
  duration_seconds?: number
  gross_pnl?: number
  fees?: number
  net_pnl?: number
  pnl_percent?: number
  r_multiple?: number
  stop_loss?: number
  take_profit?: number
  setup_tags?: string[]
  mistake_tags?: string[]
  rating?: number
  emotion_entry?: string
  emotion_exit?: string
  entry_reason?: string
  exit_reason?: string
  notes?: string
  status: 'open' | 'closed' | 'cancelled'
  timeframe?: string
  session?: string
  ai_score?: number
  created_at: string
}

export interface Analytics {
  total_trades: number
  open_trades: number
  winning_trades: number
  losing_trades: number
  total_pnl: number
  avg_pnl: number
  best_trade: number
  worst_trade: number
  win_rate: number
  profit_factor?: number
  avg_r?: number
  total_fees?: number
  avg_duration_seconds?: number
}

export interface EquityPoint {
  date: string
  daily_pnl: number
  cumulative_pnl: number
  trades_count: number
  wins: number
  losses: number
}

// ── Core fetch ────────────────────────────────────────────────────
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = storage.get('access_token')

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401 && token) {
    const refreshed = await tryRefreshToken()
    if (refreshed) return apiFetch<T>(path, options)
    storage.remove('access_token')
    storage.remove('refresh_token')
    if (typeof window !== 'undefined') window.location.href = '/auth/login'
    throw new Error('Session expirée')
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(error.error || `Erreur ${res.status}`)
  }

  return res.json()
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = storage.get('refresh_token')
  if (!refresh) return false
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    storage.set('access_token', data.access_token)
    storage.set('refresh_token', data.refresh_token)
    return true
  } catch { return false }
}

// ── Auth ──────────────────────────────────────────────────────────
export const auth = {
  async login(email: string, password: string) {
    const data = await apiFetch<{ user: User; access_token: string; refresh_token: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    )
    storage.set('access_token', data.access_token)
    storage.set('refresh_token', data.refresh_token)
    return data
  },

  async register(email: string, password: string, first_name?: string, last_name?: string) {
    const data = await apiFetch<{ user: User; access_token: string; refresh_token: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, first_name, last_name }) }
    )
    storage.set('access_token', data.access_token)
    storage.set('refresh_token', data.refresh_token)
    return data
  },

  async me() {
    return apiFetch<{ user: User }>('/auth/me')
  },

  logout() {
    const refresh = storage.get('refresh_token')
    if (refresh) {
      apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => {})
    }
    storage.remove('access_token')
    storage.remove('refresh_token')
    window.location.href = '/auth/login'
  },

  isAuthenticated() {
    return !!storage.get('access_token')
  },
}

// ── Accounts ──────────────────────────────────────────────────────
export const accounts = {
  list: () => apiFetch<{ accounts: Account[] }>('/accounts'),
  get: (id: string) => apiFetch<{ account: Account }>(`/accounts/${id}`),
  create: (data: Partial<Account> & { api_key?: string; api_secret?: string }) =>
    apiFetch<{ account: Account }>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Account>) =>
    apiFetch<{ account: Account }>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}

// ── Trades ────────────────────────────────────────────────────────
export interface TradeFilters {
  page?: number; limit?: number; status?: string; symbol?: string
  side?: string; account_id?: string; date_from?: string; date_to?: string
  sort?: string; order?: string
}

export const trades = {
  list: (filters: TradeFilters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)) })
    return apiFetch<{ trades: Trade[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/trades?${params}`)
  },
  get: (id: string) => apiFetch<{ trade: Trade }>(`/trades/${id}`),
  create: (data: Partial<Trade>) =>
    apiFetch<{ trade: Trade }>('/trades', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Trade>) =>
    apiFetch<{ trade: Trade }>(`/trades/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/trades/${id}`, { method: 'DELETE' }),
}

// ── Analytics ─────────────────────────────────────────────────────
export const analytics = {
  overview: (period = '30d', account_id?: string) => {
    const params = new URLSearchParams({ period })
    if (account_id) params.set('account_id', account_id)
    return apiFetch<{ overview: Analytics; period: string }>(`/analytics/overview?${params}`)
  },
  equityCurve: (account_id?: string) =>
    apiFetch<{ equity_curve: EquityPoint[] }>(`/analytics/equity-curve${account_id ? `?account_id=${account_id}` : ''}`),
  calendar: (year: number, month: number, account_id?: string) => {
    const params = new URLSearchParams({ year: String(year), month: String(month) })
    if (account_id) params.set('account_id', account_id)
    return apiFetch<{ calendar: Array<{ date: string; pnl: number; trades_count: number }> }>(`/analytics/calendar?${params}`)
  },
  bySymbol: (account_id?: string) =>
    apiFetch<{ by_symbol: Array<{ symbol: string; trades: number; total_pnl: number; win_rate: number; avg_r: number }> }>(`/analytics/by-symbol${account_id ? `?account_id=${account_id}` : ''}`),
  bySession: (account_id?: string) =>
    apiFetch<{ by_session: Array<{ session: string; trades: number; total_pnl: number; win_rate: number }> }>(`/analytics/by-session${account_id ? `?account_id=${account_id}` : ''}`),
  byMistakes: (account_id?: string) =>
    apiFetch<{ by_mistakes: Array<{ mistake: string; occurrences: number; total_pnl_impact: number }> }>(`/analytics/by-mistakes${account_id ? `?account_id=${account_id}` : ''}`),
  bySetup: (account_id?: string) =>
    apiFetch<{ by_setup: Array<{ setup: string; trades: number; total_pnl: number; win_rate: number }> }>(`/analytics/by-setup${account_id ? `?account_id=${account_id}` : ''}`),
  drawdown: (account_id?: string) =>
    apiFetch<{ drawdown: Array<{ date: string; cumulative_pnl: number; drawdown_pct: number }>; max_drawdown_pct: number }>(`/analytics/drawdown${account_id ? `?account_id=${account_id}` : ''}`)
}