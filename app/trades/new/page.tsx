'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { trades, accounts, Account } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Save, X } from 'lucide-react'

const SETUP_PRESETS   = ['Breakout','Pullback','Reversal','Trend Follow','Range','Support/Resistance','EMA Cross','RSI Divergence','Volume Spike','News Play','Scalp','Swing']
const MISTAKE_PRESETS = ['FOMO','Early Entry','Late Entry','No SL','Oversize','Revenge Trade','Ignored Plan','Early Exit','Late Exit','Over-leveraged','Tilt','News Ignored']
const EMOTIONS        = ['😌 Calme','😤 Confiant','😰 Stressé','😨 Peur','🤑 Euphorique','😑 Neutre','😤 Frustré','🥶 Hésitant']
const SESSIONS        = ['Asian','London','New York','London/NY Overlap','Pre-Market','After-Hours']
const TIMEFRAMES      = ['1m','3m','5m','15m','30m','1h','2h','4h','8h','1D','1W']
const ASSET_CLASSES   = ['crypto','forex','indices','stocks','commodities','mixed']
const TRADING_MODES   = ['Spot','Futures']
const TRADING_STYLES  = ['Swing','Day trading','Scalping','DCA']
const ORDER_TYPES     = ['Market','Limit']
const BLOCKCHAINS     = ['Bitcoin','Ethereum','Solana','BNB Smart Chain','XRP Ledger','Cardano','TRON','Avalanche','Polkadot','Polygon','Near Protocol','Arbitrum','Base','Optimism','Toncoin','Cosmos','Aptos','Sui']
const MARKET_CONDITIONS = ['trending','ranging','volatile','breakout']

interface FormData {
  account_id: string; symbol: string; side: 'long'|'short'; asset_class: string
  trading_mode: string; blockchain: string; token_contract: string
  entry_price: string; exit_price: string
  quantity: string; amount: string
  leverage: string; fees: string
  entry_time: string; exit_time: string
  vwap: string; order_type: string
  stop_loss: string; take_profit: string; risk_percent: string
  timeframe: string; session: string; market_condition: string; trading_style: string
  setup_tags: string[]
  entry_reason: string; exit_reason: string
  rating: string; emotion_entry: string; emotion_exit: string
  mistake_tags: string[]; notes: string
}

function toLocalDatetime(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const off = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - off).toISOString().slice(0, 16)
  } catch { return '' }
}

const now = toLocalDatetime(new Date().toISOString())

const DEFAULT: FormData = {
  account_id:'', symbol:'', side:'long', asset_class:'crypto',
  trading_mode:'', blockchain:'', token_contract:'',
  entry_price:'', exit_price:'', quantity:'', amount:'',
  leverage:'1', fees:'0',
  entry_time: now, exit_time:'',
  vwap:'', order_type:'',
  stop_loss:'', take_profit:'', risk_percent:'',
  timeframe:'', session:'', market_condition:'', trading_style:'',
  setup_tags:[], entry_reason:'', exit_reason:'',
  rating:'', emotion_entry:'', emotion_exit:'', mistake_tags:[], notes:'',
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="tl-label">{label}{hint && <span className="ml-1 text-gray-400 font-normal normal-case tracking-normal">— {hint}</span>}</label>
      {children}
    </div>
  )
}

function TagPicker({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (t: string[]) => void }) {
  const [custom, setCustom] = useState('')
  const toggle = (t: string) => onChange(selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map(t => (
          <button key={t} type="button" onClick={() => toggle(t)}
            className={cn('badge text-xs transition-all', selected.includes(t) ? 'bg-accent text-white' : 'bg-light-hover dark:bg-dark-hover text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200')}>
            {t}
          </button>
        ))}
      </div>
      {selected.filter(t => !options.includes(t)).map(t => (
        <span key={t} className="inline-flex items-center gap-1 badge bg-accent/20 text-accent text-xs mr-1">
          {t}
          <button type="button" onClick={() => toggle(t)} className="hover:text-loss ml-0.5">×</button>
        </span>
      ))}
      <div className="flex gap-2 mt-1">
        <input className="tl-input text-xs flex-1" placeholder="Tag personnalisé..." value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (custom.trim()) { toggle(custom.trim()); setCustom('') } } }} />
        <button type="button" className="btn-secondary text-xs !py-1.5 !px-3"
          onClick={() => { if (custom.trim()) { toggle(custom.trim()); setCustom('') } }}>+</button>
      </div>
    </div>
  )
}

// ── Bidirectional Qty/Amount ──────────────────────────────────────
function QtyAmountFields({
  entryPrice, qty, amount, onQtyChange, onAmountChange,
}: {
  entryPrice: string; qty: string; amount: string
  onQtyChange: (v: string) => void; onAmountChange: (v: string) => void
}) {
  const ep = parseFloat(entryPrice)

  const handleQtyBlur = (raw: string) => {
    const n = parseFloat(raw)
    onQtyChange(raw)
    if (!isNaN(n) && ep > 0) {
      onAmountChange(parseFloat((n * ep).toFixed(2)).toString())
    }
  }

  const handleAmountBlur = (raw: string) => {
    const amt = parseFloat(raw)
    onAmountChange(raw)
    if (!isNaN(amt) && ep > 0) {
      onQtyChange(parseFloat((amt / ep).toFixed(8)).toString())
    }
  }

  return (
    <>
      <Field label="Quantité">
        <input className="tl-input" type="text" inputMode="decimal"
          placeholder="0.1"
          defaultValue={qty}
          key={`qty-${qty}`}
          onBlur={e => handleQtyBlur(e.target.value)}
          required />
      </Field>
      <Field label="Montant" hint={ep > 0 && qty ? `${ep} × ${qty}` : 'Prix × Qté'}>
        <div className="relative">
          <input className="tl-input w-full pr-7" type="text" inputMode="decimal"
            placeholder={ep > 0 && qty ? parseFloat((parseFloat(qty) * ep).toFixed(2)).toString() : 'ex: 1000'}
            defaultValue={amount}
            key={`amt-${amount}`}
            onBlur={e => handleAmountBlur(e.target.value)} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">$</span>
        </div>
      </Field>
    </>
  )
}

export default function NewTradePage() {
  const router = useRouter()
  const [form, setForm]           = useState<FormData>(DEFAULT)
  const [accountList, setAccountList] = useState<Account[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    accounts.list().then(d => {
      setAccountList(d.accounts)
      if (d.accounts.length > 0)
        setForm(f => ({ ...f, account_id: d.accounts.find(a => a.is_default)?.id || d.accounts[0].id }))
    })
  }, [])

  const set = (key: keyof FormData | string, value: any) => setForm(f => ({ ...f, [key]: value }))

  const estimatedPnL = (() => {
    const ep = parseFloat(form.entry_price), xp = parseFloat(form.exit_price)
    const qty = parseFloat(form.quantity), fees = parseFloat(form.fees) || 0
    if (!ep || !xp || !qty) return null
    return (form.side === 'long' ? 1 : -1) * (xp - ep) * qty - fees
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (!form.account_id) return setError('Sélectionne un compte')
    if (!form.symbol) return setError('Le symbole est requis')
    if (!form.entry_price) return setError("Le prix d'entrée est requis")
    if (!form.quantity) return setError('La quantité est requise')
    if (!form.entry_time) return setError("La date d'entrée est requise")

    setSubmitting(true)
    try {
      const p: any = {
        account_id:      form.account_id,
        symbol:          form.symbol.toUpperCase(),
        side:            form.side,
        asset_class:     form.asset_class,
        entry_price:     parseFloat(form.entry_price),
        quantity:        parseFloat(form.quantity),
        leverage:        parseFloat(form.leverage) || 1,
        entry_time:      new Date(form.entry_time).toISOString(),
        fees:            parseFloat(form.fees) || 0,
        setup_tags:      form.setup_tags,
        mistake_tags:    form.mistake_tags,
        entry_reason:    form.entry_reason   || undefined,
        exit_reason:     form.exit_reason    || undefined,
        rating:          form.rating ? parseInt(form.rating) : undefined,
        emotion_entry:   form.emotion_entry  || undefined,
        emotion_exit:    form.emotion_exit   || undefined,
        notes:           form.notes          || undefined,
        timeframe:       form.timeframe      || undefined,
        session:         form.session        || undefined,
        market_condition: form.market_condition || undefined,
        trading_mode:    form.trading_mode   || undefined,
        trading_style:   form.trading_style  || undefined,
        order_type:      form.order_type     || undefined,
        blockchain:      form.blockchain     || undefined,
        token_contract:  form.token_contract || undefined,
        vwap:            form.vwap ? parseFloat(form.vwap) : undefined,
        source: 'manual',
      }
      if (form.exit_price)   p.exit_price   = parseFloat(form.exit_price)
      if (form.exit_time)    p.exit_time    = new Date(form.exit_time).toISOString()
      if (form.stop_loss)    p.stop_loss    = parseFloat(form.stop_loss)
      if (form.take_profit)  p.take_profit  = parseFloat(form.take_profit)
      if (form.risk_percent) p.risk_percent = parseFloat(form.risk_percent)

      const data = await trades.create(p)
      router.push(`/trades/${data.trade.id}`)
    } catch (err: any) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  return (
    <AppLayout title="Nouveau Trade" subtitle="Saisie manuelle">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4">
        {error && (
          <div className="bg-loss/10 border border-loss/30 text-loss text-sm font-mono px-4 py-3 rounded-lg flex items-center gap-2">
            <X size={14} /> {error}
          </div>
        )}

        {/* ── 1. Instrument & Direction ── */}
        <Section title="Instrument & Direction">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Compte">
              <select className="tl-select" value={form.account_id} onChange={e => set('account_id', e.target.value)} required>
                <option value="">Sélectionner...</option>
                {accountList.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </select>
            </Field>

            <Field label="Symbole">
              <input className="tl-input uppercase" placeholder="BTCUSDT, EURUSD, NAS100..." value={form.symbol}
                onChange={e => set('symbol', e.target.value)} required />
            </Field>

            <Field label="Direction">
              <div className="flex gap-2">
                {(['long','short'] as const).map(s => (
                  <button key={s} type="button" onClick={() => set('side', s)}
                    className={cn('flex-1 py-2.5 rounded-lg text-sm font-mono font-semibold uppercase tracking-wider transition-all',
                      form.side === s
                        ? s === 'long' ? 'bg-profit text-white' : 'bg-loss text-white'
                        : 'bg-light-hover dark:bg-dark-hover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}>
                    {s === 'long' ? '▲ Long' : '▼ Short'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Statut">
              <div className="flex gap-2">
                {(['open','closed'] as const).map(s => (
                  <button key={s} type="button"
                    onClick={() => { set('status', s); if (s === 'open') { set('exit_price', ''); set('exit_time', '') } }}
                    className={cn('flex-1 py-2.5 rounded-lg text-sm font-mono font-semibold uppercase tracking-wider transition-all',
                      (s === 'open' ? !form.exit_price : !!form.exit_price)
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : 'bg-light-hover dark:bg-dark-hover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    )}>
                    {s === 'open' ? 'Ouvert' : 'Fermé'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Classe d'actif">
              <select className="tl-select" value={form.asset_class} onChange={e => set('asset_class', e.target.value)}>
                {ASSET_CLASSES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase()+a.slice(1)}</option>)}
              </select>
            </Field>

            <Field label="Mode trading">
              <select className="tl-select" value={form.trading_mode} onChange={e => set('trading_mode', e.target.value)}>
                <option value="">—</option>
                {TRADING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>

            <Field label="Blockchain">
              <select className="tl-select" value={form.blockchain} onChange={e => set('blockchain', e.target.value)}>
                <option value="">—</option>
                {BLOCKCHAINS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>

            <Field label="Contrat / Token" hint="adresse ou nom">
              <input className="tl-input" placeholder="0x... ou nom" value={form.token_contract} onChange={e => set('token_contract', e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ── 2. Exécution & Prix ── */}
        <Section title="Exécution & Prix">
          <div className="grid grid-cols-2 gap-4">
            {/* Row 1: prix entrée / sortie */}
            <Field label="Prix d'entrée">
              <input className="tl-input" type="text" inputMode="decimal" placeholder="72000" value={form.entry_price}
                onChange={e => set('entry_price', e.target.value)} required />
            </Field>
            <Field label="Prix de sortie" hint="vide = trade ouvert">
              <input className="tl-input" type="text" inputMode="decimal" placeholder="73500" value={form.exit_price}
                onChange={e => set('exit_price', e.target.value)} />
            </Field>

            {/* Row 2: quantité / montant bidirectionnel */}
            <QtyAmountFields
              entryPrice={form.entry_price}
              qty={form.quantity}
              amount={form.amount}
              onQtyChange={v => set('quantity', v)}
              onAmountChange={v => set('amount', v)}
            />

            {/* Row 3: levier / frais */}
            <Field label="Levier" hint="1 = sans levier">
              <div className="relative">
                <input className="tl-input pr-7" type="text" inputMode="decimal" placeholder="1" value={form.leverage}
                  onChange={e => set('leverage', e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">×</span>
              </div>
            </Field>
            <Field label="Frais">
              <div className="relative">
                <input className="tl-input pr-7" type="text" inputMode="decimal" placeholder="0" value={form.fees}
                  onChange={e => set('fees', e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">$</span>
              </div>
            </Field>

            {/* Row 4: dates */}
            <Field label="Date d'entrée">
              <input className="tl-input" type="datetime-local" value={form.entry_time}
                onChange={e => set('entry_time', e.target.value)} required />
            </Field>
            <Field label="Date de sortie" hint="vide = trade ouvert">
              <input className="tl-input" type="datetime-local" value={form.exit_time}
                onChange={e => set('exit_time', e.target.value)} />
            </Field>

            {/* Row 5: VWAP / type d'ordre */}
            <Field label="VWAP" hint="prix moyen pondéré">
              <div className="relative">
                <input className="tl-input pr-7" type="text" inputMode="decimal" placeholder="72100" value={form.vwap}
                  onChange={e => set('vwap', e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">$</span>
              </div>
            </Field>
            <Field label="Type d'ordre">
              <select className="tl-select" value={form.order_type} onChange={e => set('order_type', e.target.value)}>
                <option value="">—</option>
                {ORDER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>

            {/* P&L preview */}
            {estimatedPnL !== null && (
              <div className="col-span-2">
                <div className={cn('w-full rounded-lg px-4 py-2.5 border font-mono font-semibold text-sm',
                  estimatedPnL >= 0 ? 'border-profit/30 bg-profit/10 text-profit' : 'border-loss/30 bg-loss/10 text-loss')}>
                  P&L estimé : {estimatedPnL >= 0 ? '+' : ''}{estimatedPnL.toFixed(2)} $
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── 3. Gestion du Risque ── */}
        <Section title="Gestion du Risque">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Stop Loss">
              <input className="tl-input" type="text" inputMode="decimal" placeholder="71000" value={form.stop_loss}
                onChange={e => set('stop_loss', e.target.value)} />
            </Field>
            <Field label="Take Profit">
              <input className="tl-input" type="text" inputMode="decimal" placeholder="74000" value={form.take_profit}
                onChange={e => set('take_profit', e.target.value)} />
            </Field>
            <Field label="Risque (%)" hint="% du capital">
              <div className="relative">
                <input className="tl-input pr-6" type="text" inputMode="decimal" placeholder="1.5" value={form.risk_percent}
                  onChange={e => set('risk_percent', e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">%</span>
              </div>
            </Field>
          </div>
        </Section>

        {/* ── 4. Contexte de Marché ── */}
        <Section title="Contexte de Marché">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Timeframe">
              <select className="tl-select" value={form.timeframe} onChange={e => set('timeframe', e.target.value)}>
                <option value="">—</option>
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Session">
              <select className="tl-select" value={form.session} onChange={e => set('session', e.target.value)}>
                <option value="">—</option>
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Condition marché">
              <select className="tl-select" value={form.market_condition} onChange={e => set('market_condition', e.target.value)}>
                <option value="">—</option>
                {MARKET_CONDITIONS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Style trading">
              <select className="tl-select" value={form.trading_style} onChange={e => set('trading_style', e.target.value)}>
                <option value="">—</option>
                {TRADING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Setups">
            <div className="mt-1">
              <TagPicker options={SETUP_PRESETS} selected={form.setup_tags} onChange={t => set('setup_tags', t)} />
            </div>
          </Field>
        </Section>

        {/* ── 5. Journal & Notes ── */}
        <Section title="Journal & Notes">
          <div className="space-y-4">
            <Field label="Raison d'entrée">
              <textarea className="tl-input resize-none" rows={2} placeholder="Pourquoi j'ai pris ce trade..."
                value={form.entry_reason} onChange={e => set('entry_reason', e.target.value)} />
            </Field>
            <Field label="Raison de sortie">
              <textarea className="tl-input resize-none" rows={2} placeholder="Pourquoi je suis sorti..."
                value={form.exit_reason} onChange={e => set('exit_reason', e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Note globale">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => set('rating', form.rating === String(n) ? '' : String(n))}
                      className={cn('flex-1 h-9 rounded-lg text-sm font-mono transition-all',
                        form.rating === String(n) ? 'bg-accent text-white' : 'bg-light-hover dark:bg-dark-hover text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')}>
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Émotion entrée">
                <select className="tl-select" value={form.emotion_entry} onChange={e => set('emotion_entry', e.target.value)}>
                  <option value="">—</option>
                  {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </Field>
              <Field label="Émotion sortie">
                <select className="tl-select" value={form.emotion_exit} onChange={e => set('emotion_exit', e.target.value)}>
                  <option value="">—</option>
                  {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Erreurs identifiées">
              <div className="mt-1">
                <TagPicker options={MISTAKE_PRESETS} selected={form.mistake_tags} onChange={t => set('mistake_tags', t)} />
              </div>
            </Field>
            <Field label="Notes libres">
              <textarea className="tl-input resize-none" rows={3}
                placeholder="Observations, leçons apprises..."
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ── Submit ── */}
        <div className="flex items-center justify-end gap-3 py-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex items-center gap-2">
            <X size={14} /> Annuler
          </button>
          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2 min-w-[140px] justify-center">
            {submitting
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Save size={14} /> Enregistrer</>}
          </button>
        </div>
      </form>
    </AppLayout>
  )
}
