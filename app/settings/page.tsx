'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { accounts, Account } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatPnL, formatDate } from '@/lib/utils'
import {
  Plus, Check, ChevronDown, ChevronUp,
  Wifi, WifiOff, RefreshCw, Trash2, Edit3,
  Shield, Zap, Key, AlertCircle, X
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────

const PLAN_INFO = {
  free:  { label: 'FREE',  color: 'text-gray-500 dark:text-gray-400', accounts: 1,        trades: '50/mois',  price: null },
  pro:   { label: 'PRO',   color: 'text-accent',                       accounts: 5,        trades: 'Illimité', price: '29€/mois' },
  algo:  { label: 'ALGO',  color: 'text-profit',                       accounts: Infinity, trades: 'Illimité', price: '99€/mois' },
}

const EXCHANGES = [
  { value: 'binance',  label: 'Binance',  hasPassphrase: false, defaultSymbols: 'BTCUSDT,ETHUSDT' },
  { value: 'bybit',    label: 'Bybit',    hasPassphrase: false, defaultSymbols: '', categories: ['spot', 'linear', 'inverse'] },
  { value: 'mexc',     label: 'MEXC',     hasPassphrase: false, defaultSymbols: 'BTCUSDT' },
  { value: 'bitget',   label: 'Bitget',   hasPassphrase: true,  defaultSymbols: 'BTCUSDT' },
]

const MANUAL_BROKERS = ['manual', 'mt4', 'mt5', 'interactive_brokers', 'tradingview', 'other']
const ASSET_CLASSES  = ['crypto', 'forex', 'indices', 'stocks', 'commodities', 'mixed']
const CURRENCIES     = ['USD', 'EUR', 'USDT', 'BTC', 'GBP', 'CHF']

// ── Types ─────────────────────────────────────────────────────────────────

interface SyncResult {
  ok?: boolean
  error?: string
  detail?: string
  inserted?: number
  skipped?: number
  total?: number
  broker?: string
}

interface AccountFormData {
  name: string
  broker: string
  asset_class: string
  currency: string
  initial_balance: string
  api_key: string
  api_secret: string
  api_passphrase: string
  sync_enabled: boolean
  symbols: string
  category: string
}

const defaultForm = (): AccountFormData => ({
  name: '', broker: 'binance', asset_class: 'crypto',
  currency: 'USDT', initial_balance: '',
  api_key: '', api_secret: '', api_passphrase: '',
  sync_enabled: true, symbols: 'BTCUSDT,ETHUSDT', category: 'spot',
})

// ── Helper ────────────────────────────────────────────────────────────────

async function apiCall(path: string, method = 'GET', body?: object) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
  return data
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display font-700 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
      {children}
    </h3>
  )
}

function AccountCard({
  account,
  onSync,
  onDelete,
  onUpdate,
}: {
  account: Account
  onSync: (id: string) => Promise<void>
  onDelete: (id: string) => void
  onUpdate: () => void
}) {
  const [expanded,   setExpanded]   = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [testResult, setTestResult] = useState<SyncResult | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  // Edit info
  const [editInfo,  setEditInfo]  = useState(false)
  const [info, setInfo] = useState({
    name:            account.name,
    asset_class:     account.asset_class,
    currency:        account.currency,
    initial_balance: account.initial_balance ? String(account.initial_balance) : '',
    notes:           account.notes || '',
  })
  const [savingInfo, setSavingInfo] = useState(false)

  // Edit keys
  const [editKeys,  setEditKeys]  = useState(false)
  const [keys, setKeys] = useState({
    api_key: '', api_secret: '', api_passphrase: '',
    symbols: account.sync_config?.symbols || '',
    category: account.sync_config?.category || 'spot',
    sync_enabled: account.sync_enabled ?? false,
  })
  const [savingKeys, setSavingKeys] = useState(false)

  const exchange = EXCHANGES.find(e => e.value === account.broker)

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const data = await apiCall(`/accounts/${account.id}/sync/test`, 'POST')
      setTestResult({ ok: true, ...data })
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message })
    } finally { setTesting(false) }
  }

  const handleSync = async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const data = await apiCall(`/accounts/${account.id}/sync`, 'POST')
      setSyncResult(data); onUpdate()
    } catch (err: any) {
      setSyncResult({ error: err.message })
    } finally { setSyncing(false) }
  }

  const handleSaveInfo = async () => {
    setSavingInfo(true)
    try {
      await apiCall(`/accounts/${account.id}`, 'PATCH', {
        name:            info.name,
        asset_class:     info.asset_class,
        currency:        info.currency,
        initial_balance: info.initial_balance ? parseFloat(info.initial_balance) : undefined,
        notes:           info.notes || null,
      })
      setEditInfo(false)
      onUpdate()
    } catch (err: any) { alert(err.message) }
    finally { setSavingInfo(false) }
  }

  const handleSaveKeys = async () => {
    setSavingKeys(true)
    try {
      const payload: any = {
        sync_enabled: keys.sync_enabled,
        sync_config: {
          symbols:  keys.symbols  || undefined,
          category: keys.category || undefined,
        },
      }
      if (keys.api_key)        payload.api_key        = keys.api_key
      if (keys.api_secret)     payload.api_secret     = keys.api_secret
      if (keys.api_passphrase) payload.api_passphrase = keys.api_passphrase
      await apiCall(`/accounts/${account.id}`, 'PATCH', payload)
      setEditKeys(false)
      setKeys(k => ({ ...k, api_key: '', api_secret: '', api_passphrase: '' }))
      onUpdate()
    } catch (err: any) { alert(err.message) }
    finally { setSavingKeys(false) }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-light-hover dark:hover:bg-dark-hover transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            account.sync_enabled && account.has_api_key ? 'bg-profit animate-pulse-slow' : 'bg-gray-400'
          )} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900 dark:text-white">{account.name}</span>
              {account.is_default && (
                <span className="badge bg-accent/10 text-accent text-[10px]">DEFAULT</span>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono uppercase">
              {account.broker} · {account.asset_class} · {account.currency}
              {account.last_sync_at && (
                <span className="ml-2 normal-case">· Sync {formatDate(account.last_sync_at)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-mono text-gray-500">{account.total_trades || 0} trades</div>
            {account.has_api_key && <div className="text-[10px] font-mono text-profit">API connectée</div>}
          </div>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-light-border dark:border-dark-border px-4 py-4 space-y-4 bg-light-hover/30 dark:bg-dark-hover/30">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Trades',    value: account.total_trades || 0 },
              { label: 'P&L Total', value: formatPnL(account.total_pnl) },
              { label: 'Ouverts',   value: account.open_trades  || 0 },
            ].map(s => (
              <div key={s.label} className="bg-light-surface dark:bg-dark-surface rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 font-mono mb-1">{s.label}</div>
                <div className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Edit infos ────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                Informations du compte
              </span>
              <button
                onClick={() => { setEditInfo(!editInfo); setEditKeys(false) }}
                className="text-xs font-mono text-accent hover:underline flex items-center gap-1"
              >
                <Edit3 size={11} /> {editInfo ? 'Annuler' : 'Modifier'}
              </button>
            </div>

            {editInfo ? (
              <div className="bg-light-surface dark:bg-dark-surface rounded-xl p-4 space-y-3 border border-light-border dark:border-dark-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="tl-label">Nom</label>
                    <input className="tl-input w-full" value={info.name} onChange={e => setInfo(i => ({ ...i, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="tl-label">Classe d'actif</label>
                    <select className="tl-select w-full" value={info.asset_class} onChange={e => setInfo(i => ({ ...i, asset_class: e.target.value }))}>
                      {ASSET_CLASSES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="tl-label">Devise</label>
                    <select className="tl-select w-full" value={info.currency} onChange={e => setInfo(i => ({ ...i, currency: e.target.value }))}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="tl-label">Solde initial</label>
                    <input className="tl-input w-full" type="number" step="any" value={info.initial_balance} onChange={e => setInfo(i => ({ ...i, initial_balance: e.target.value }))} />
                  </div>
                  <div>
                    <label className="tl-label">Notes</label>
                    <input className="tl-input w-full" value={info.notes} onChange={e => setInfo(i => ({ ...i, notes: e.target.value }))} />
                  </div>
                </div>
                <button onClick={handleSaveInfo} disabled={savingInfo} className="btn-primary flex items-center gap-2 text-xs !py-2">
                  {savingInfo ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                  Enregistrer
                </button>
              </div>
            ) : (
              <div className="text-xs font-mono text-gray-500 space-y-1 px-1">
                {account.initial_balance && <div>Solde initial: <span className="text-gray-700 dark:text-gray-300">{account.initial_balance.toLocaleString()} {account.currency}</span></div>}
                {account.notes && <div className="text-gray-400 italic">{account.notes}</div>}
              </div>
            )}
          </div>

          {/* ── Exchange sync ─────────────────────────────── */}
          {exchange && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Clés API {exchange.label}
                </span>
                <button
                  onClick={() => { setEditKeys(!editKeys); setEditInfo(false) }}
                  className="text-xs font-mono text-accent hover:underline flex items-center gap-1"
                >
                  <Key size={11} /> {editKeys ? 'Annuler' : account.has_api_key ? 'Modifier les clés' : 'Ajouter les clés'}
                </button>
              </div>

              {editKeys && (
                <div className="bg-light-surface dark:bg-dark-surface rounded-xl p-4 space-y-3 border border-light-border dark:border-dark-border">
                  <div className="flex items-start gap-2 text-xs text-gray-500 font-mono bg-accent/5 border border-accent/20 rounded-lg p-2.5">
                    <Shield size={12} className="text-accent mt-0.5 flex-shrink-0" />
                    Clés chiffrées AES-256. Permissions lecture seule suffisent.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="tl-label">API Key</label>
                      <input className="tl-input font-mono text-xs w-full" placeholder={account.has_api_key ? '••••• (inchangé si vide)' : 'Ta clé API'} value={keys.api_key} onChange={e => setKeys(k => ({ ...k, api_key: e.target.value }))} />
                    </div>
                    <div>
                      <label className="tl-label">API Secret</label>
                      <input className="tl-input font-mono text-xs w-full" type="password" placeholder={account.has_api_key ? '••••• (inchangé si vide)' : 'Ton secret'} value={keys.api_secret} onChange={e => setKeys(k => ({ ...k, api_secret: e.target.value }))} />
                    </div>
                    {exchange.hasPassphrase && (
                      <div className="sm:col-span-2">
                        <label className="tl-label">Passphrase</label>
                        <input className="tl-input font-mono text-xs w-full" type="password" placeholder="Ton passphrase" value={keys.api_passphrase} onChange={e => setKeys(k => ({ ...k, api_passphrase: e.target.value }))} />
                      </div>
                    )}
                    {exchange.categories ? (
                      <div>
                        <label className="tl-label">Catégorie</label>
                        <select className="tl-select w-full" value={keys.category} onChange={e => setKeys(k => ({ ...k, category: e.target.value }))}>
                          {exchange.categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="sm:col-span-2">
                        <label className="tl-label">Symboles</label>
                        <input className="tl-input font-mono text-xs w-full" placeholder="BTCUSDT,ETHUSDT" value={keys.symbols} onChange={e => setKeys(k => ({ ...k, symbols: e.target.value }))} />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <div className={cn('w-9 h-5 rounded-full transition-colors relative', keys.sync_enabled ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600')} onClick={() => setKeys(k => ({ ...k, sync_enabled: !k.sync_enabled }))}>
                          <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', keys.sync_enabled ? 'translate-x-4' : 'translate-x-0.5')} />
                        </div>
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-400">Sync automatique (toutes les heures)</span>
                      </label>
                    </div>
                  </div>
                  <button onClick={handleSaveKeys} disabled={savingKeys} className="btn-primary flex items-center gap-2 text-xs !py-2">
                    {savingKeys ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                    Enregistrer
                  </button>
                </div>
              )}

              {account.has_api_key && !editKeys && (
                <div className="space-y-2">
                  {/* Symboles sauvegardés */}
                  {account.sync_config?.symbols && (
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-light-hover dark:bg-dark-hover rounded-lg px-3 py-2">
                      <span className="text-gray-400 uppercase tracking-widest text-[10px]">Symboles · </span>
                      {account.sync_config.symbols.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                        <span key={s} className="inline-block bg-accent/10 text-accent rounded px-1.5 py-0.5 text-[10px] font-semibold mr-1 mb-1">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleTest} disabled={testing} className="btn-secondary flex items-center gap-1.5 text-xs !py-1.5 !px-3">
                      {testing ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Wifi size={13} />}
                      Tester la connexion
                    </button>
                    <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-1.5 text-xs !py-1.5 !px-3">
                      {syncing ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={13} />}
                      Sync maintenant
                    </button>
                    <span className={cn('text-[10px] font-mono px-2 py-1 rounded-full', account.sync_enabled ? 'bg-profit/10 text-profit' : 'bg-gray-500/10 text-gray-500')}>
                      {account.sync_enabled ? '● AUTO ON' : '○ AUTO OFF'}
                    </span>
                  </div>
                </div>
              )}

              {testResult && (
                <div className={cn('flex items-start gap-2 text-xs font-mono px-3 py-2.5 rounded-lg', testResult.ok ? 'bg-profit/10 text-profit border border-profit/20' : 'bg-loss/10 text-loss border border-loss/20')}>
                  {testResult.ok ? <><Check size={12} className="mt-0.5" /> Connexion {testResult.broker} OK</> : <><WifiOff size={12} className="mt-0.5 flex-shrink-0" /> {testResult.error}{testResult.detail && ` — ${testResult.detail}`}</>}
                  <button onClick={() => setTestResult(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={11} /></button>
                </div>
              )}
              {syncResult && (
                <div className={cn('text-xs font-mono px-3 py-2.5 rounded-lg border', syncResult.error ? 'bg-loss/10 text-loss border-loss/20' : 'bg-profit/10 text-profit border-profit/20')}>
                  {syncResult.error ? `❌ ${syncResult.error}` : `✓ ${syncResult.inserted} trades importés · ${syncResult.skipped} doublons ignorés`}
                  <button onClick={() => setSyncResult(null)} className="ml-2 opacity-50 hover:opacity-100"><X size={11} /></button>
                </div>
              )}
            </div>
          )}

          {/* Delete */}
          <div className="pt-2 border-t border-light-border dark:border-dark-border flex justify-end">
            <button onClick={() => onDelete(account.id)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-loss transition-colors font-mono">
              <Trash2 size={12} /> Supprimer ce compte
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth()
  const [accountList, setAccountList] = useState<Account[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [flash,       setFlash]       = useState('')
  const [form,        setForm]        = useState<AccountFormData>(defaultForm())
  const [activeTab,   setActiveTab]   = useState<'exchange' | 'manual'>('exchange')

  const load = async () => {
    setLoading(true)
    try {
      const data = await accounts.list()
      setAccountList(data.accounts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const selectedExchange = EXCHANGES.find(e => e.value === form.broker)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: any = {
        name:            form.name,
        broker:          form.broker,
        asset_class:     form.asset_class,
        currency:        form.currency,
        initial_balance: form.initial_balance ? parseFloat(form.initial_balance) : undefined,
        sync_enabled:    form.sync_enabled,
      }
      if (form.api_key) {
        payload.api_key    = form.api_key
        payload.api_secret = form.api_secret
        if (form.api_passphrase) payload.api_passphrase = form.api_passphrase
      }
      if (form.symbols || form.category) {
        payload.sync_config = {
          symbols:  form.symbols  || undefined,
          category: form.category || undefined,
        }
      }
      await accounts.create(payload)
      setFlash('Compte créé avec succès !')
      setShowForm(false)
      setForm(defaultForm())
      load()
      setTimeout(() => setFlash(''), 4000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce compte et tous ses trades ?')) return
    try {
      await apiCall(`/accounts/${id}`, 'DELETE')
      load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleSync = async (id: string) => {
    await apiCall(`/accounts/${id}/sync`, 'POST')
    load()
  }

  const plan = user ? PLAN_INFO[user.plan] : PLAN_INFO.free

  return (
    <AppLayout title="Paramètres" subtitle="Comptes & synchronisation">
      <div className="max-w-2xl space-y-4">

        {/* Flash message */}
        {flash && (
          <div className="flex items-center gap-2 bg-profit/10 border border-profit/30 text-profit text-xs font-mono px-4 py-3 rounded-lg">
            <Check size={13} /> {flash}
          </div>
        )}

        {/* ── Plan ─────────────────────────────────────────────── */}
        <div className="card p-5">
          <SectionTitle>Plan & Quota</SectionTitle>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className={cn('font-mono font-bold text-3xl', plan.color)}>{plan.label}</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-gray-500">Comptes: <span className="text-gray-800 dark:text-gray-200 font-semibold">{plan.accounts === Infinity ? '∞' : plan.accounts}</span></div>
                <div className="text-gray-500">Trades: <span className="text-gray-800 dark:text-gray-200 font-semibold">{plan.trades}</span></div>
                {user && <div className="text-gray-500">Ce mois: <span className="text-gray-800 dark:text-gray-200 font-semibold">{user.trades_this_month || 0} trades</span></div>}
              </div>
            </div>
            {user?.plan === 'free' && (
              <div className="space-y-2">
                <button className="btn-primary flex items-center gap-2 text-xs w-full justify-center">
                  <Zap size={13} /> Pro — 29€/mois
                </button>
                <button className="btn-secondary flex items-center gap-2 text-xs w-full justify-center">
                  <Zap size={13} /> Algo — 99€/mois
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Comptes ───────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-900 dark:text-white">
              Comptes de Trading
            </h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 text-xs font-mono text-accent hover:underline"
            >
              <Plus size={12} /> {showForm ? 'Annuler' : 'Ajouter un compte'}
            </button>
          </div>

          {/* ── New account form ─────────────────────────────── */}
          {showForm && (
            <div className="card p-4 space-y-4">
              <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-gray-500">Nouveau compte</h4>

              {/* Tab: Exchange vs Manual */}
              <div className="flex gap-1 bg-light-hover dark:bg-dark-hover rounded-lg p-1 w-fit">
                {(['exchange', 'manual'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab)
                      setForm(f => ({ ...f, broker: tab === 'exchange' ? 'binance' : 'manual' }))
                    }}
                    className={cn(
                      'px-4 py-1.5 rounded-md text-xs font-mono font-semibold uppercase tracking-wide transition-all',
                      activeTab === tab ? 'bg-accent text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    )}
                  >
                    {tab === 'exchange' ? '⚡ Exchange' : '✏️ Manuel'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreate} className="space-y-3">
                {/* Common fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="tl-label">Nom du compte *</label>
                    <input
                      className="tl-input"
                      placeholder={activeTab === 'exchange' ? 'Binance Spot Principal' : 'Mon compte Manuel'}
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>

                  {activeTab === 'exchange' ? (
                    <div>
                      <label className="tl-label">Exchange *</label>
                      <select
                        className="tl-select"
                        value={form.broker}
                        onChange={e => {
                          const ex = EXCHANGES.find(x => x.value === e.target.value)
                          setForm(f => ({ ...f, broker: e.target.value, symbols: ex?.defaultSymbols || '' }))
                        }}
                      >
                        {EXCHANGES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="tl-label">Broker</label>
                      <select className="tl-select" value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value }))}>
                        {MANUAL_BROKERS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="tl-label">Devise</label>
                    <select className="tl-select" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="tl-label">Classe d'actif</label>
                    <select className="tl-select" value={form.asset_class} onChange={e => setForm(f => ({ ...f, asset_class: e.target.value }))}>
                      {ASSET_CLASSES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="tl-label">Solde initial</label>
                    <input
                      className="tl-input"
                      type="number"
                      step="any"
                      placeholder="10000"
                      value={form.initial_balance}
                      onChange={e => setForm(f => ({ ...f, initial_balance: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Exchange API fields */}
                {activeTab === 'exchange' && (
                  <div className="space-y-3 pt-3 border-t border-light-border dark:border-dark-border">
                    <div className="flex items-start gap-2 text-xs text-gray-500 font-mono bg-accent/5 border border-accent/20 rounded-lg p-2.5">
                      <Shield size={12} className="text-accent mt-0.5 flex-shrink-0" />
                      <span>Clés chiffrées AES-256. Utilise des clés <strong>lecture seule</strong> — ne jamais activer les permissions de retrait.</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="tl-label">API Key</label>
                        <input
                          className="tl-input font-mono text-xs"
                          placeholder="Ta clé API"
                          value={form.api_key}
                          onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="tl-label">API Secret</label>
                        <input
                          className="tl-input font-mono text-xs"
                          type="password"
                          placeholder="Ton secret"
                          value={form.api_secret}
                          onChange={e => setForm(f => ({ ...f, api_secret: e.target.value }))}
                        />
                      </div>

                      {selectedExchange?.hasPassphrase && (
                        <div className="sm:col-span-2">
                          <label className="tl-label">Passphrase</label>
                          <input
                            className="tl-input font-mono text-xs"
                            type="password"
                            placeholder="Ton passphrase Bitget"
                            value={form.api_passphrase}
                            onChange={e => setForm(f => ({ ...f, api_passphrase: e.target.value }))}
                          />
                        </div>
                      )}

                      {selectedExchange?.categories ? (
                        <div>
                          <label className="tl-label">Catégorie</label>
                          <select className="tl-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                            {selectedExchange.categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="sm:col-span-2">
                          <label className="tl-label">Symboles à suivre</label>
                          <input
                            className="tl-input font-mono text-xs"
                            placeholder="BTCUSDT,ETHUSDT,SOLUSDT"
                            value={form.symbols}
                            onChange={e => setForm(f => ({ ...f, symbols: e.target.value }))}
                          />
                          <p className="text-[10px] text-gray-500 font-mono mt-1">Séparés par des virgules</p>
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer w-fit">
                          <div
                            className={cn(
                              'w-9 h-5 rounded-full transition-colors relative',
                              form.sync_enabled ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'
                            )}
                            onClick={() => setForm(f => ({ ...f, sync_enabled: !f.sync_enabled }))}
                          >
                            <div className={cn(
                              'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                              form.sync_enabled ? 'translate-x-4' : 'translate-x-0.5'
                            )} />
                          </div>
                          <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                            Activer la sync automatique (toutes les heures)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 text-xs !py-2">
                    {saving
                      ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Check size={12} />
                    }
                    Créer le compte
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs !py-2">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Account list */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : accountList.length === 0 ? (
            <div className="card py-12 text-center">
              <p className="text-gray-500 text-sm font-mono mb-3">Aucun compte configuré</p>
              <button onClick={() => setShowForm(true)} className="btn-primary text-xs inline-flex items-center gap-2">
                <Plus size={12} /> Ajouter un compte
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {accountList.map(acc => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  onSync={handleSync}
                  onDelete={handleDelete}
                  onUpdate={load}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Mon compte ───────────────────────────────────────── */}
        {user && (
          <div className="card p-5">
            <SectionTitle>Mon Compte</SectionTitle>
            <div className="space-y-2 text-sm font-mono">
              {[
                { label: 'Email', value: user.email },
                ...(user.first_name ? [{ label: 'Prénom', value: user.first_name }] : []),
                ...(user.last_name  ? [{ label: 'Nom',    value: user.last_name  }] : []),
                { label: 'Plan', value: <span className={plan.color}>{plan.label}</span> },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-light-border dark:border-dark-border last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-800 dark:text-gray-200">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}
