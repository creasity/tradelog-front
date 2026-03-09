'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { trades, accounts, Account } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Save, X, Plus, ChevronDown } from 'lucide-react'

const SETUP_PRESETS = ['breakout', 'retest', 'fakeout', 'support_bounce', 'resistance_rejection', 'trend_follow', 'reversal', 'scalp', 'swing']
const MISTAKE_PRESETS = ['fomo_entry', 'moved_sl', 'early_exit', 'oversize', 'revenge_trade', 'bad_timing', 'no_plan', 'ignored_sl']
const EMOTIONS = ['calm', 'confident', 'fomo', 'anxious', 'greedy', 'frustrated', 'neutral', 'excited']
const SESSIONS = ['asian', 'london', 'ny', 'overlap', 'other']
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', 'D', 'W']
const ASSET_CLASSES   = ['crypto', 'forex', 'indices', 'stocks', 'commodities']
const TRADING_MODES  = ['Spot', 'Futures']
const TRADING_STYLES = ['Swing', 'Day trading', 'Scalping', 'DCA']
const ORDER_TYPES    = ['Market', 'Limit']
const BLOCKCHAINS    = [
  'Bitcoin', 'Ethereum', 'Solana', 'BNB Smart Chain', 'XRP Ledger',
  'Cardano', 'TRON', 'Avalanche', 'Polkadot', 'Polygon', 'Near Protocol',
  'Arbitrum', 'Base', 'Optimism', 'Toncoin', 'Cosmos', 'Aptos', 'Sui',
]

interface FormData {
  account_id: string
  symbol: string
  side: 'long' | 'short'
  asset_class: string
  entry_price: string
  exit_price: string
  quantity: string
  leverage: string
  entry_time: string
  exit_time: string
  fees: string
  stop_loss: string
  take_profit: string
  risk_percent: string
  timeframe: string
  session: string
  market_condition: string
  setup_tags: string[]
  entry_reason: string
  exit_reason: string
  rating: string
  emotion_entry: string
  emotion_exit: string
  mistake_tags: string[]
  notes: string
  trading_mode: string
  trading_style: string
  order_type: string
  blockchain: string
  token_contract: string
  vwap: string
  position_size: string
}

const DEFAULT: FormData = {
  account_id: '', symbol: '', side: 'long', asset_class: 'crypto',
  entry_price: '', exit_price: '', quantity: '', leverage: '1',
  entry_time: new Date().toISOString().slice(0, 16),
  exit_time: '', fees: '0',
  stop_loss: '', take_profit: '', risk_percent: '',
  timeframe: '', session: '', market_condition: '',
  setup_tags: [], entry_reason: '', exit_reason: '',
  rating: '', emotion_entry: '', emotion_exit: '',
  mistake_tags: [], notes: '',
  trading_mode: '', trading_style: '', order_type: '',
  blockchain: '', token_contract: '', vwap: '', position_size: '',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4 pb-3 border-b border-light-border dark:border-dark-border">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="tl-label">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1 font-mono">{hint}</p>}
    </div>
  )
}

function TagSelector({ options, selected, onChange }: {
  options: string[]
  selected: string[]
  onChange: (tags: string[]) => void
}) {
  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className={cn(
            'badge text-xs transition-all',
            selected.includes(tag)
              ? 'bg-accent text-white'
              : 'bg-light-hover dark:bg-dark-hover text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}

export default function NewTradePage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(DEFAULT)
  const [accountList, setAccountList] = useState<Account[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    accounts.list().then(d => {
      setAccountList(d.accounts)
      if (d.accounts.length > 0) {
        setForm(f => ({ ...f, account_id: d.accounts.find(a => a.is_default)?.id || d.accounts[0].id }))
      }
    })
  }, [])

  const set = (key: keyof FormData | string, value: string | string[]) =>
    setForm(f => ({ ...f, [key]: value }))

  // Auto-calculate estimated P&L
  const estimatedPnL = (() => {
    const ep = parseFloat(form.entry_price)
    const xp = parseFloat(form.exit_price)
    const qty = parseFloat(form.quantity)
    const lev = parseFloat(form.leverage) || 1
    const fees = parseFloat(form.fees) || 0
    if (!ep || !xp || !qty) return null
    const mult = form.side === 'long' ? 1 : -1
    return mult * (xp - ep) * qty * lev - fees
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.account_id) return setError('Sélectionne un compte')
    if (!form.symbol) return setError('Le symbole est requis')
    if (!form.entry_price) return setError("Le prix d'entrée est requis")
    if (!form.quantity) return setError('La quantité est requise')
    if (!form.entry_time) return setError("La date d'entrée est requise")

    setSubmitting(true)
    try {
      const payload: any = {
        account_id: form.account_id,
        symbol: form.symbol.toUpperCase(),
        side: form.side,
        asset_class: form.asset_class,
        entry_price: parseFloat(form.entry_price),
        quantity: parseFloat(form.quantity),
        leverage: parseFloat(form.leverage) || 1,
        entry_time: new Date(form.entry_time).toISOString(),
        fees: parseFloat(form.fees) || 0,
        setup_tags: form.setup_tags,
        mistake_tags: form.mistake_tags,
        entry_reason: form.entry_reason || undefined,
        exit_reason: form.exit_reason || undefined,
        rating: form.rating ? parseInt(form.rating) : undefined,
        emotion_entry: form.emotion_entry || undefined,
        emotion_exit: form.emotion_exit || undefined,
        notes: form.notes || undefined,
        timeframe: form.timeframe || undefined,
        session: form.session || undefined,
        market_condition: form.market_condition || undefined,
        trading_mode:    (form as any).trading_mode    || undefined,
        trading_style:   (form as any).trading_style   || undefined,
        order_type:      (form as any).order_type      || undefined,
        blockchain:      (form as any).blockchain      || undefined,
        token_contract:  (form as any).token_contract  || undefined,
        vwap:            (form as any).vwap ? parseFloat((form as any).vwap) : undefined,
        source: 'manual',
      }

      if (form.exit_price) payload.exit_price = parseFloat(form.exit_price)
      if (form.exit_time) payload.exit_time = new Date(form.exit_time).toISOString()
      if (form.stop_loss) payload.stop_loss = parseFloat(form.stop_loss)
      if (form.take_profit) payload.take_profit = parseFloat(form.take_profit)
      if (form.risk_percent) payload.risk_percent = parseFloat(form.risk_percent)

      const data = await trades.create(payload)
      router.push(`/trades/${data.trade.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout title="Nouveau Trade" subtitle="Saisie manuelle">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">
        {error && (
          <div className="bg-loss/10 border border-loss/30 text-loss text-sm font-mono px-4 py-3 rounded-lg flex items-center gap-2">
            <X size={14} /> {error}
          </div>
        )}

        {/* Instrument */}
        <Section title="Instrument & Direction">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Compte">
              <select className="tl-select" value={form.account_id} onChange={e => set('account_id', e.target.value)} required>
                <option value="">Sélectionner...</option>
                {accountList.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </select>
            </Field>

            <Field label="Symbole">
              <input
                className="tl-input uppercase"
                placeholder="BTCUSDT, EURUSD, NAS100..."
                value={form.symbol}
                onChange={e => set('symbol', e.target.value)}
                required
              />
            </Field>

            <Field label="Direction">
              <div className="flex gap-2">
                {(['long', 'short'] as const).map(side => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => set('side', side)}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-mono font-semibold uppercase tracking-wider transition-all',
                      form.side === side
                        ? side === 'long'
                          ? 'bg-profit text-white'
                          : 'bg-loss text-white'
                        : 'bg-light-hover dark:bg-dark-hover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                  >
                    {side === 'long' ? '▲ Long' : '▼ Short'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Classe d'actif">
              <select className="tl-select" value={form.asset_class} onChange={e => set('asset_class', e.target.value)}>
                {ASSET_CLASSES.map(a => (
                  <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                ))}
              </select>
            </Field>

            <Field label="Mode trading">
              <select className="tl-select" value={(form as any).trading_mode} onChange={e => set('trading_mode', e.target.value)}>
                <option value="">—</option>
                {TRADING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>

            <Field label="Blockchain">
              <select className="tl-select" value={(form as any).blockchain} onChange={e => set('blockchain', e.target.value)}>
                <option value="">—</option>
                {BLOCKCHAINS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>

            <Field label="Contrat / Token" hint="Adresse ou nom du token">
              <input
                className="tl-input"
                placeholder="0x... ou nom du token"
                value={(form as any).token_contract}
                onChange={e => set('token_contract', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* Execution */}
        <Section title="Exécution & Prix">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prix d'entrée" hint="Prix moyen d'entrée">
              <input className="tl-input" type="number" step="any" placeholder="42000" value={form.entry_price} onChange={e => set('entry_price', e.target.value)} required />
            </Field>

            <Field label="Prix de sortie" hint="Laisser vide si trade ouvert">
              <input className="tl-input" type="number" step="any" placeholder="43500" value={form.exit_price} onChange={e => set('exit_price', e.target.value)} />
            </Field>

            <Field label="Quantité">
              <input className="tl-input" type="number" step="any" placeholder="0.1" value={form.quantity} onChange={e => set('quantity', e.target.value)} required />
            </Field>

            <Field label="Levier" hint="1 = pas de levier">
              <input className="tl-input" type="number" step="any" min="1" placeholder="1" value={form.leverage} onChange={e => set('leverage', e.target.value)} />
            </Field>

            <Field label="Date/heure d'entrée">
              <input className="tl-input" type="datetime-local" value={form.entry_time} onChange={e => set('entry_time', e.target.value)} required />
            </Field>

            <Field label="Date/heure de sortie">
              <input className="tl-input" type="datetime-local" value={form.exit_time} onChange={e => set('exit_time', e.target.value)} />
            </Field>

            <Field label="Frais (commissions)">
              <input className="tl-input" type="number" step="any" placeholder="0" value={form.fees} onChange={e => set('fees', e.target.value)} />
            </Field>

            <Field label="Type d'ordre">
              <select className="tl-select" value={(form as any).order_type} onChange={e => set('order_type', e.target.value)}>
                <option value="">—</option>
                {ORDER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="Montant de position ($)" hint="Calcule la quantité si vide">
              <input
                className="tl-input"
                type="number"
                step="any"
                placeholder={form.entry_price && form.quantity
                  ? (parseFloat(form.entry_price) * parseFloat(form.quantity)).toFixed(2)
                  : 'ex: 1000'}
                value={(form as any).position_size}
                onChange={e => {
                  set('position_size', e.target.value)
                  const amount = parseFloat(e.target.value)
                  const price  = parseFloat(form.entry_price)
                  if (amount > 0 && price > 0 && !form.quantity)
                    set('quantity', (amount / price).toFixed(8))
                }}
              />
            </Field>

            <Field label="VWAP" hint="Prix moyen pondéré par volume">
              <input className="tl-input" type="number" step="any" placeholder="42100" value={(form as any).vwap} onChange={e => set('vwap', e.target.value)} />
            </Field>

            {/* P&L preview */}
            {estimatedPnL !== null && (
              <div className="flex items-end">
                <div className={cn(
                  'w-full rounded-lg px-4 py-2.5 border font-mono font-semibold text-sm',
                  estimatedPnL >= 0
                    ? 'border-profit/30 bg-profit/10 text-profit'
                    : 'border-loss/30 bg-loss/10 text-loss'
                )}>
                  P&L estimé : {estimatedPnL >= 0 ? '+' : ''}{estimatedPnL.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Risk */}
        <Section title="Gestion du Risque">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Stop Loss">
              <input className="tl-input" type="number" step="any" placeholder="41000" value={form.stop_loss} onChange={e => set('stop_loss', e.target.value)} />
            </Field>
            <Field label="Take Profit">
              <input className="tl-input" type="number" step="any" placeholder="44000" value={form.take_profit} onChange={e => set('take_profit', e.target.value)} />
            </Field>
            <Field label="Risque (%)" hint="% du capital risqué">
              <input className="tl-input" type="number" step="any" placeholder="1.5" value={form.risk_percent} onChange={e => set('risk_percent', e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* Context */}
        <Section title="Contexte de Marché">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Field label="Timeframe">
              <select className="tl-select" value={form.timeframe} onChange={e => set('timeframe', e.target.value)}>
                <option value="">—</option>
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Session">
              <select className="tl-select" value={form.session} onChange={e => set('session', e.target.value)}>
                <option value="">—</option>
                {SESSIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Condition marché">
              <select className="tl-select" value={form.market_condition} onChange={e => set('market_condition', e.target.value)}>
                <option value="">—</option>
                {['trending', 'ranging', 'volatile', 'breakout'].map(m => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </Field>

            <Field label="Style trading">
              <select className="tl-select" value={(form as any).trading_style} onChange={e => set('trading_style', e.target.value)}>
                <option value="">—</option>
                {TRADING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Setups utilisés">
            <div className="mt-1">
              <TagSelector options={SETUP_PRESETS} selected={form.setup_tags} onChange={tags => set('setup_tags', tags)} />
            </div>
          </Field>
        </Section>

        {/* Journal */}
        <Section title="Journal & Notes">
          <div className="space-y-4">
            <Field label="Raison d'entrée">
              <textarea
                className="tl-input resize-none"
                rows={2}
                placeholder="Pourquoi j'ai pris ce trade..."
                value={form.entry_reason}
                onChange={e => set('entry_reason', e.target.value)}
              />
            </Field>

            <Field label="Raison de sortie">
              <textarea
                className="tl-input resize-none"
                rows={2}
                placeholder="Pourquoi je suis sorti..."
                value={form.exit_reason}
                onChange={e => set('exit_reason', e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Note globale">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('rating', form.rating === String(n) ? '' : String(n))}
                      className={cn(
                        'flex-1 h-9 rounded-lg text-sm font-mono transition-all',
                        form.rating === String(n)
                          ? 'bg-accent text-white'
                          : 'bg-light-hover dark:bg-dark-hover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Émotion à l'entrée">
                <select className="tl-select" value={form.emotion_entry} onChange={e => set('emotion_entry', e.target.value)}>
                  <option value="">—</option>
                  {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </Field>

              <Field label="Émotion à la sortie">
                <select className="tl-select" value={form.emotion_exit} onChange={e => set('emotion_exit', e.target.value)}>
                  <option value="">—</option>
                  {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Erreurs identifiées">
              <div className="mt-1">
                <TagSelector options={MISTAKE_PRESETS} selected={form.mistake_tags} onChange={tags => set('mistake_tags', tags)} />
              </div>
            </Field>

            <Field label="Notes libres">
              <textarea
                className="tl-input resize-none"
                rows={3}
                placeholder="Observations, leçons apprises, idées pour la prochaine fois..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 py-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex items-center gap-2">
            <X size={14} /> Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex items-center gap-2 min-w-[140px] justify-center"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save size={14} /> Enregistrer</>
            )}
          </button>
        </div>
      </form>
    </AppLayout>
  )
}
