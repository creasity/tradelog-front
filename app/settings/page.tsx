'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { accounts, Account } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Check, RefreshCw } from 'lucide-react'

const PLAN_INFO = {
  free:  { label: 'FREE',  color: 'text-gray-400', accounts: 1, trades: '50/mois' },
  pro:   { label: 'PRO',   color: 'text-accent',   accounts: 5, trades: 'Illimité' },
  algo:  { label: 'ALGO',  color: 'text-profit',   accounts: '∞', trades: 'Illimité' },
}

const BROKERS = ['manual', 'binance', 'bybit', 'okx', 'kucoin', 'mt4', 'mt5', 'interactive_brokers', 'other']
const ASSET_CLASSES = ['crypto', 'forex', 'indices', 'stocks', 'commodities', 'mixed']

export default function SettingsPage() {
  const { user } = useAuth()
  const [accountList, setAccountList] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [newAccount, setNewAccount] = useState({
    name: '', broker: 'manual', asset_class: 'crypto',
    currency: 'USD', initial_balance: '',
    api_key: '', api_secret: '',
  })

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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await accounts.create({
        name: newAccount.name,
        broker: newAccount.broker as any,
        asset_class: newAccount.asset_class as any,
        currency: newAccount.currency,
        initial_balance: newAccount.initial_balance ? parseFloat(newAccount.initial_balance) : undefined,
        ...(newAccount.api_key ? { api_key: newAccount.api_key, api_secret: newAccount.api_secret } : {}),
      })
      setSuccess(true)
      setShowNewForm(false)
      setNewAccount({ name: '', broker: 'manual', asset_class: 'crypto', currency: 'USD', initial_balance: '', api_key: '', api_secret: '' })
      load()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const plan = user ? PLAN_INFO[user.plan] : PLAN_INFO.free

  return (
    <AppLayout title="Paramètres" subtitle="Comptes & configuration">
      <div className="max-w-2xl space-y-4">

        {/* Plan info */}
        <div className="card p-5">
          <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
            Plan & Quota
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <span className={cn('font-mono font-bold text-2xl', plan.color)}>{plan.label}</span>
              <div className="mt-2 space-y-1 text-xs font-mono text-gray-400">
                <div>Comptes: <span className="text-gray-700 dark:text-gray-300">{plan.accounts}</span></div>
                <div>Trades: <span className="text-gray-700 dark:text-gray-300">{plan.trades}</span></div>
                {user && <div>Trades ce mois: <span className="text-gray-700 dark:text-gray-300">{user.trades_this_month || 0}</span></div>}
              </div>
            </div>
            {user?.plan === 'free' && (
              <button className="btn-primary text-xs">
                Passer à Pro — 29€/mois
              </button>
            )}
          </div>
        </div>

        {/* Accounts */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Comptes de Trading
            </h3>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="flex items-center gap-1.5 text-xs font-mono text-accent hover:underline"
            >
              <Plus size={12} /> Ajouter
            </button>
          </div>

          {success && (
            <div className="flex items-center gap-2 bg-profit/10 border border-profit/30 text-profit text-xs font-mono px-3 py-2.5 rounded-lg mb-4">
              <Check size={12} /> Compte créé avec succès
            </div>
          )}

          {/* New account form */}
          {showNewForm && (
            <form onSubmit={handleCreateAccount} className="bg-light-hover dark:bg-dark-hover rounded-xl p-4 mb-4 space-y-3">
              <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-gray-400 mb-3">Nouveau compte</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="tl-label">Nom</label>
                  <input className="tl-input" placeholder="Binance Spot" value={newAccount.name} onChange={e => setNewAccount(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="tl-label">Broker</label>
                  <select className="tl-select" value={newAccount.broker} onChange={e => setNewAccount(f => ({ ...f, broker: e.target.value }))}>
                    {BROKERS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="tl-label">Classe d'actif</label>
                  <select className="tl-select" value={newAccount.asset_class} onChange={e => setNewAccount(f => ({ ...f, asset_class: e.target.value }))}>
                    {ASSET_CLASSES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="tl-label">Devise</label>
                  <select className="tl-select" value={newAccount.currency} onChange={e => setNewAccount(f => ({ ...f, currency: e.target.value }))}>
                    {['USD', 'EUR', 'USDT', 'BTC', 'GBP'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="tl-label">Solde initial</label>
                  <input className="tl-input" type="number" step="any" placeholder="10000" value={newAccount.initial_balance} onChange={e => setNewAccount(f => ({ ...f, initial_balance: e.target.value }))} />
                </div>
              </div>
              {newAccount.broker !== 'manual' && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-light-border dark:border-dark-border">
                  <div>
                    <label className="tl-label">API Key (optionnel)</label>
                    <input className="tl-input font-mono text-xs" placeholder="Clé API exchange" value={newAccount.api_key} onChange={e => setNewAccount(f => ({ ...f, api_key: e.target.value }))} />
                  </div>
                  <div>
                    <label className="tl-label">API Secret</label>
                    <input className="tl-input font-mono text-xs" type="password" placeholder="Secret API" value={newAccount.api_secret} onChange={e => setNewAccount(f => ({ ...f, api_secret: e.target.value }))} />
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 text-xs !py-2">
                  {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={12} />}
                  Créer
                </button>
                <button type="button" onClick={() => setShowNewForm(false)} className="btn-secondary text-xs !py-2">Annuler</button>
              </div>
            </form>
          )}

          {/* Account list */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
            </div>
          ) : accountList.length === 0 ? (
            <p className="text-center text-gray-400 text-sm font-mono py-8">
              Aucun compte — clique sur "Ajouter" pour commencer
            </p>
          ) : (
            <div className="space-y-2">
              {accountList.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-light-hover dark:bg-dark-hover">
                  <div className="flex items-center gap-3">
                    {acc.is_default && (
                      <span className="badge bg-accent/10 text-accent text-[10px]">DEFAULT</span>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{acc.name}</div>
                      <div className="text-xs text-gray-400 font-mono uppercase">{acc.broker} · {acc.asset_class} · {acc.currency}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {acc.has_api_key && (
                      <span className="text-[10px] font-mono text-profit bg-profit/10 px-1.5 py-0.5 rounded">API ✓</span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">{acc.total_trades || 0} trades</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User info */}
        {user && (
          <div className="card p-5">
            <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
              Mon Compte
            </h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span className="text-gray-700 dark:text-gray-300">{user.email}</span>
              </div>
              {(user.first_name || user.last_name) && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Nom</span>
                  <span className="text-gray-700 dark:text-gray-300">{user.first_name} {user.last_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Plan</span>
                <span className={plan.color}>{plan.label}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
