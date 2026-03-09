'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { trades, accounts, Trade, Account } from '@/lib/api'
import { cn, formatPnL, formatDate, formatDuration, getPnLColor, toNum } from '@/lib/utils'
import {
  ArrowLeft, Edit3, Check, X, Trash2, Star,
  TrendingUp, TrendingDown, Clock, Layers,
  Tag, AlertTriangle, FileText, Image, Plus,
  ChevronRight, Zap,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────

const SETUP_TAGS_PRESETS = [
  'Breakout', 'Pullback', 'Reversal', 'Trend Follow', 'Range', 'Support/Resistance',
  'EMA Cross', 'RSI Divergence', 'Volume Spike', 'News Play', 'Scalp', 'Swing',
]

const MISTAKE_TAGS_PRESETS = [
  'FOMO', 'Early Entry', 'Late Entry', 'No SL', 'Oversize', 'Revenge Trade',
  'Ignored Plan', 'Early Exit', 'Late Exit', 'Over-leveraged', 'Tilt', 'News Ignored',
]

const EMOTIONS = ['😌 Calme', '😤 Confiant', '😰 Stressé', '😨 Peur', '🤑 Euphorique', '😑 Neutre', '😤 Frustré', '🥶 Hésitant']
const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '1D', '1W']
const SESSIONS       = ['Asian', 'London', 'New York', 'London/NY Overlap', 'Pre-Market', 'After-Hours']
const TRADING_MODES  = ['Spot', 'Futures']
const TRADING_STYLES = ['Swing', 'Day trading', 'Scalping', 'DCA']
const ORDER_TYPES    = ['Market', 'Limit']
const BLOCKCHAINS    = [
  'Bitcoin', 'Ethereum', 'Solana', 'BNB Smart Chain', 'XRP Ledger',
  'Cardano', 'TRON', 'Avalanche', 'Polkadot', 'Polygon', 'Near Protocol',
  'Arbitrum', 'Base', 'Optimism', 'Toncoin', 'Cosmos', 'Aptos', 'Sui',
]

// ── Helpers ───────────────────────────────────────────────────────

function computePnL(trade: Partial<Trade>): { gross: number; net: number; pct: number; r: number } {
  const entry = toNum(trade.entry_price)
  const exit  = toNum(trade.exit_price)
  const qty   = toNum(trade.quantity)
  const fees  = toNum(trade.fees)
  const sl    = toNum(trade.stop_loss)

  if (!entry || !exit || !qty) return { gross: 0, net: 0, pct: 0, r: 0 }

  const dir   = trade.side === 'long' ? 1 : -1
  const gross = (exit - entry) * qty * dir
  const net   = gross - fees
  const pct   = ((exit - entry) / entry) * 100 * dir
  const risk  = sl ? Math.abs(entry - sl) * qty : 0
  const r     = risk > 0 ? net / risk : 0

  return { gross, net, pct, r }
}

// ── Sub-components ────────────────────────────────────────────────

function StatPill({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-light-hover dark:bg-dark-hover rounded-xl p-3 text-center', className)}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{value}</div>
    </div>
  )
}

function EditableField({
  label, value, type = 'text', options, onChange, suffix,
}: {
  label: string
  value: string | number | undefined
  type?: 'text' | 'number' | 'datetime-local' | 'select' | 'textarea'
  options?: string[]
  onChange: (v: string) => void
  suffix?: string
}) {
  return (
    <div>
      <label className="tl-label">{label}</label>
      {type === 'select' && options ? (
        <select className="tl-select w-full" value={value ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          className="tl-input w-full resize-none min-h-[80px] text-sm"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="..."
        />
      ) : (
        <div className="relative">
          <input
            className="tl-input w-full"
            type={type}
            step={type === 'number' ? 'any' : undefined}
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">{suffix}</span>
          )}
        </div>
      )}
    </div>
  )
}

function TagSelector({
  label, icon, selected, presets, color, onChange,
}: {
  label: string; icon: React.ReactNode; selected: string[]
  presets: string[]; color: string; onChange: (tags: string[]) => void
}) {
  const [custom, setCustom] = useState('')

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }

  const addCustom = () => {
    const t = custom.trim()
    if (t && !selected.includes(t)) { onChange([...selected, t]); setCustom('') }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs font-mono font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={cn(
              'text-[11px] font-mono px-2.5 py-1 rounded-full border transition-all',
              selected.includes(tag)
                ? `${color} border-current bg-current/10 font-semibold`
                : 'text-gray-500 dark:text-gray-400 border-light-border dark:border-dark-border hover:border-gray-400'
            )}
          >
            {tag}
          </button>
        ))}
        {selected.filter(t => !presets.includes(t)).map(tag => (
          <span key={tag} className={cn('text-[11px] font-mono px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1', color, 'border-current bg-current/10')}>
            {tag}
            <button type="button" onClick={() => toggle(tag)}><X size={9} /></button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            className="text-[11px] font-mono px-2 py-1 rounded-full border border-dashed border-light-border dark:border-dark-border bg-transparent w-24 focus:outline-none focus:border-accent text-gray-600 dark:text-gray-400"
            placeholder="+ Custom"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          />
        </div>
      </div>
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
        >
          <Star
            size={20}
            className={cn(
              'transition-colors',
              n <= (hover || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'
            )}
          />
        </button>
      ))}
      {value > 0 && <span className="text-xs text-gray-400 font-mono ml-1">{value}/5</span>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────

export default function TradeDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string
  const fileRef = useRef<HTMLInputElement>(null)

  const [trade,    setTrade]    = useState<Trade | null>(null)
  const [draft,    setDraft]    = useState<Partial<Trade>>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dirty,    setDirty]    = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [screenshots, setScreenshots] = useState<string[]>([]) // base64
  const [activeTab, setActiveTab] = useState<'overview' | 'journal' | 'media'>('overview')

  useEffect(() => {
    const load = async () => {
      try {
        const [tradeData, accData] = await Promise.all([
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/trades/${id}`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
          ).then(r => r.json()),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/accounts`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
          ).then(r => r.json()),
        ])
        setTrade(tradeData.trade)
        setDraft(tradeData.trade)
        setAccounts(accData.accounts || [])
        // Load screenshots from notes if stored as JSON
        try {
          const meta = JSON.parse(tradeData.trade?.notes_meta || '{}')
          if (Array.isArray(meta.screenshots)) setScreenshots(meta.screenshots)
        } catch {}
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const set = (key: keyof Trade | string, value: any) => {
    setDraft(d => ({ ...d, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      const payload = { ...draft }
      // Remove read-only fields
      delete (payload as any).id
      delete (payload as any).created_at
      delete (payload as any).account_name
      delete (payload as any).user_id

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/trades/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) throw new Error('Erreur sauvegarde')
      const data = await res.json()
      setTrade(data.trade)
      setDraft(data.trade)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce trade définitivement ?')) return
    setDeleting(true)
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/trades/${id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      )
      router.push('/trades')
    } catch {
      setDeleting(false)
    }
  }

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const base64 = ev.target?.result as string
        setScreenshots(s => [...s, base64])
        setDirty(true)
      }
      reader.readAsDataURL(file)
    })
  }

  const removeScreenshot = (idx: number) => {
    setScreenshots(s => s.filter((_, i) => i !== idx))
    setDirty(true)
  }

  // Computed P&L from draft
  const pnl = computePnL(draft)
  const hasPnL = !!(draft.exit_price && draft.entry_price)

  if (loading) {
    return (
      <AppLayout title="Trade" subtitle="Chargement...">
        <div className="space-y-4 max-w-3xl">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      </AppLayout>
    )
  }

  if (!trade) {
    return (
      <AppLayout title="Trade introuvable" subtitle="">
        <div className="card p-8 text-center max-w-md">
          <p className="text-gray-500 font-mono text-sm mb-4">Ce trade n'existe pas ou a été supprimé.</p>
          <button onClick={() => router.push('/trades')} className="btn-primary text-xs">
            Retour aux trades
          </button>
        </div>
      </AppLayout>
    )
  }

  const isLong    = draft.side === 'long'
  const isClosed  = draft.status === 'closed'
  const pnlColor  = pnl.net >= 0 ? 'text-profit' : 'text-loss'

  return (
    <AppLayout
      title={`${draft.symbol || trade.symbol}`}
      subtitle={`${draft.side?.toUpperCase()} · ${isClosed ? 'Fermé' : 'Ouvert'}`}
    >
      <div className="max-w-3xl space-y-4">

        {/* ── Top bar ────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => router.push('/trades')}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-mono transition-colors"
          >
            <ArrowLeft size={14} /> Tous les trades
          </button>

          <div className="flex items-center gap-2">
            {dirty && (
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest animate-pulse">
                Modifications non sauvegardées
              </span>
            )}
            {saved && (
              <span className="text-[10px] font-mono text-profit uppercase tracking-widest flex items-center gap-1">
                <Check size={10} /> Sauvegardé
              </span>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5 hover:text-loss hover:border-loss/50 transition-colors"
            >
              <Trash2 size={12} /> Supprimer
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="btn-primary !py-1.5 !px-4 text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              {saving
                ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Check size={12} />
              }
              Sauvegarder
            </button>
          </div>
        </div>

        {/* ── Hero ───────────────────────────────────────────── */}
        <div className={cn(
          'card p-5 border-l-4',
          isClosed
            ? pnl.net >= 0 ? 'border-l-profit' : 'border-l-loss'
            : 'border-l-accent'
        )}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            {/* Symbol + side */}
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                isLong ? 'bg-profit/15' : 'bg-loss/15'
              )}>
                {isLong
                  ? <TrendingUp size={20} className="text-profit" />
                  : <TrendingDown size={20} className="text-loss" />
                }
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-800 text-2xl uppercase tracking-wider text-gray-900 dark:text-white">
                    {draft.symbol || trade.symbol}
                  </span>
                  <span className={cn(
                    'badge text-xs font-mono font-bold',
                    isLong ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
                  )}>
                    {draft.side?.toUpperCase()}
                  </span>
                  <span className={cn(
                    'badge text-[10px]',
                    isClosed ? 'bg-gray-500/10 text-gray-500' : 'bg-accent/10 text-accent'
                  )}>
                    {(draft.status || 'open').toUpperCase()}
                  </span>
                  {(draft as any).trading_mode && (
                    <span className="badge text-[10px] bg-accent/10 text-accent">
                      {(draft as any).trading_mode}
                    </span>
                  )}
                  {(draft as any).trading_style && (
                    <span className="badge text-[10px] bg-gray-500/10 text-gray-500">
                      {(draft as any).trading_style}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                  {formatDate(draft.entry_time || trade.entry_time)}
                  {draft.duration_seconds && ` · ${formatDuration(draft.duration_seconds)}`}
                  {draft.account_name && ` · ${draft.account_name}`}
                </div>
              </div>
            </div>

            {/* P&L */}
            {hasPnL && (
              <div className="text-right">
                <div className={cn('font-mono font-bold text-3xl', pnlColor)}>
                  {formatPnL(pnl.net)}
                </div>
                <div className="text-xs font-mono text-gray-500 dark:text-gray-400 space-x-2 mt-0.5">
                  <span>{pnl.pct >= 0 ? '+' : ''}{pnl.pct.toFixed(2)}%</span>
                  {pnl.r !== 0 && <span className={pnlColor}>{pnl.r >= 0 ? '+' : ''}{pnl.r.toFixed(2)}R</span>}
                </div>
              </div>
            )}
          </div>

          {/* Key stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <StatPill label="Entrée"   value={`$${toNum(draft.entry_price).toLocaleString()}`} />
            <StatPill label="Sortie"   value={draft.exit_price ? `$${toNum(draft.exit_price).toLocaleString()}` : '—'} />
            <StatPill label="Position" value={draft.entry_price && draft.quantity ? `$${(toNum(draft.entry_price) * toNum(draft.quantity)).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'} />
            <StatPill label="Frais"    value={draft.fees ? formatPnL(-toNum(draft.fees)) : '—'} />
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────── */}
        <div className="flex gap-1 bg-light-hover dark:bg-dark-hover rounded-xl p-1 w-fit">
          {([
            { key: 'overview', label: '📊 Données' },
            { key: 'journal',  label: '📝 Journal' },
            { key: 'media',    label: `🖼 Charts (${screenshots.length})` },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                activeTab === tab.key
                  ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview (Trade data) ──────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Core trade fields */}
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold">
                Données du trade
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Symbole"     value={draft.symbol}      onChange={v => set('symbol', v.toUpperCase())} />
                <div>
                  <label className="tl-label">Direction</label>
                  <div className="flex gap-2">
                    {(['long', 'short'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set('side', s)}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-xs font-mono font-bold uppercase border transition-all',
                          draft.side === s
                            ? s === 'long'
                              ? 'bg-profit/15 text-profit border-profit/30'
                              : 'bg-loss/15 text-loss border-loss/30'
                            : 'border-light-border dark:border-dark-border text-gray-500 hover:border-gray-400'
                        )}
                      >
                        {s === 'long' ? '↑ Long' : '↓ Short'}
                      </button>
                    ))}
                  </div>
                </div>
                <EditableField label="Prix d'entrée"   value={draft.entry_price} type="number" onChange={v => set('entry_price', parseFloat(v))} suffix="$" />
                <EditableField label="Prix de sortie"  value={draft.exit_price}  type="number" onChange={v => set('exit_price', v ? parseFloat(v) : undefined)} suffix="$" />
                <EditableField label="Quantité"        value={draft.quantity}    type="number" onChange={v => set('quantity', parseFloat(v))} />
                <EditableField label="Levier"          value={draft.leverage}    type="number" onChange={v => set('leverage', v ? parseInt(v) : 1)} suffix="×" />
                <EditableField label="Stop Loss"       value={draft.stop_loss}   type="number" onChange={v => set('stop_loss', v ? parseFloat(v) : undefined)} suffix="$" />
                <EditableField label="Take Profit"     value={draft.take_profit} type="number" onChange={v => set('take_profit', v ? parseFloat(v) : undefined)} suffix="$" />
                <EditableField label="Frais"           value={draft.fees}        type="number" onChange={v => set('fees', v ? parseFloat(v) : 0)} suffix="$" />
                <div>
                  <label className="tl-label">Statut</label>
                  <select className="tl-select w-full" value={draft.status || 'open'} onChange={e => set('status', e.target.value)}>
                    <option value="open">Ouvert</option>
                    <option value="closed">Fermé</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </div>
                <EditableField
                  label="Date d'entrée"
                  value={draft.entry_time ? new Date(draft.entry_time).toISOString().slice(0, 16) : ''}
                  type="datetime-local"
                  onChange={v => set('entry_time', new Date(v).toISOString())}
                />
                <EditableField
                  label="Date de sortie"
                  value={draft.exit_time ? new Date(draft.exit_time).toISOString().slice(0, 16) : ''}
                  type="datetime-local"
                  onChange={v => set('exit_time', v ? new Date(v).toISOString() : undefined)}
                />
                <EditableField label="Timeframe" value={draft.timeframe} type="select" options={TIMEFRAMES} onChange={v => set('timeframe', v)} />
                <EditableField label="Session"   value={draft.session}   type="select" options={SESSIONS}   onChange={v => set('session', v)} />
              </div>
            </div>

            {/* ── Instrument ── */}
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold">
                Instrument
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Mode trading" value={(draft as any).trading_mode} type="select" options={TRADING_MODES} onChange={v => set('trading_mode', v)} />
                <EditableField label="Blockchain"   value={(draft as any).blockchain}   type="select" options={BLOCKCHAINS}   onChange={v => set('blockchain', v)} />
                <div className="sm:col-span-2">
                  <EditableField label="Contrat / Token" value={(draft as any).token_contract} onChange={v => set('token_contract', v)} />
                </div>
              </div>
            </div>

            {/* ── Exécution & Prix ── */}
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold">
                Exécution & Prix
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Type d'ordre" value={(draft as any).order_type} type="select" options={ORDER_TYPES} onChange={v => set('order_type', v)} />
                <EditableField label="VWAP"         value={(draft as any).vwap}       type="number" onChange={v => set('vwap', v ? parseFloat(v) : undefined)} suffix="$" />
                <div className="sm:col-span-2">
                  <label className="tl-label">Montant de position</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        className="tl-input w-full"
                        type="number"
                        step="any"
                        value={(draft.entry_price && draft.quantity)
                          ? (toNum(draft.entry_price) * toNum(draft.quantity)).toFixed(2)
                          : ''}
                        onChange={e => {
                          const amount = parseFloat(e.target.value)
                          const price  = toNum(draft.entry_price)
                          if (amount > 0 && price > 0) set('quantity', parseFloat((amount / price).toFixed(8)))
                        }}
                        placeholder="Calcul auto depuis prix × quantité"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">$</span>
                    </div>
                    {draft.entry_price && draft.quantity && (
                      <span className="text-xs text-gray-400 font-mono whitespace-nowrap flex-shrink-0">
                        {toNum(draft.entry_price).toLocaleString()} × {draft.quantity}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Contexte de marché ── */}
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold">
                Contexte de marché
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Style trading" value={(draft as any).trading_style} type="select" options={TRADING_STYLES} onChange={v => set('trading_style', v)} />
              </div>
            </div>

            {/* P&L preview if modified */}
            {dirty && hasPnL && (
              <div className={cn(
                'card p-4 border flex items-center justify-between flex-wrap gap-3',
                pnl.net >= 0 ? 'border-profit/30 bg-profit/5' : 'border-loss/30 bg-loss/5'
              )}>
                <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">P&L calculé</span>
                <div className="flex items-center gap-4 font-mono text-sm">
                  <span className="text-gray-500">Brut: <span className={pnlColor}>{formatPnL(pnl.gross)}</span></span>
                  <span className="text-gray-500">Net: <span className={cn(pnlColor, 'font-bold')}>{formatPnL(pnl.net)}</span></span>
                  <span className="text-gray-500">R: <span className={pnlColor}>{pnl.r >= 0 ? '+' : ''}{pnl.r.toFixed(2)}R</span></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Journal ───────────────────────────────────── */}
        {activeTab === 'journal' && (
          <div className="space-y-4">

            {/* Rating */}
            <div className="card p-5">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold mb-3">
                Note du trade
              </h3>
              <StarRating
                value={draft.rating || 0}
                onChange={v => set('rating', v)}
              />
            </div>

            {/* Emotions */}
            <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="tl-label flex items-center gap-1.5">
                  <span className="text-base">😊</span> Émotion à l'entrée
                </label>
                <select className="tl-select w-full" value={draft.emotion_entry || ''} onChange={e => set('emotion_entry', e.target.value)}>
                  <option value="">—</option>
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="tl-label flex items-center gap-1.5">
                  <span className="text-base">😊</span> Émotion à la sortie
                </label>
                <select className="tl-select w-full" value={draft.emotion_exit || ''} onChange={e => set('emotion_exit', e.target.value)}>
                  <option value="">—</option>
                  {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Reasons */}
            <div className="card p-5 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold">
                Raisons
              </h3>
              <EditableField
                label="Raison d'entrée"
                value={draft.entry_reason}
                type="textarea"
                onChange={v => set('entry_reason', v)}
              />
              <EditableField
                label="Raison de sortie"
                value={draft.exit_reason}
                type="textarea"
                onChange={v => set('exit_reason', v)}
              />
            </div>

            {/* Tags */}
            <div className="card p-5 space-y-5">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold">
                Tags
              </h3>
              <TagSelector
                label="Setups"
                icon={<Tag size={12} />}
                selected={draft.setup_tags || []}
                presets={SETUP_TAGS_PRESETS}
                color="text-accent"
                onChange={v => set('setup_tags', v)}
              />
              <TagSelector
                label="Erreurs"
                icon={<AlertTriangle size={12} />}
                selected={draft.mistake_tags || []}
                presets={MISTAKE_TAGS_PRESETS}
                color="text-loss"
                onChange={v => set('mistake_tags', v)}
              />
            </div>

            {/* Notes */}
            <div className="card p-5">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold mb-3 flex items-center gap-2">
                <FileText size={13} /> Notes
              </h3>
              <EditableField
                label=""
                value={draft.notes}
                type="textarea"
                onChange={v => set('notes', v)}
              />
            </div>

            {/* AI Score */}
            {trade.ai_score !== undefined && trade.ai_score !== null && (
              <div className="card p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <Zap size={18} className="text-accent" />
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">Score IA</div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-mono font-bold text-accent">{(toNum(trade.ai_score) * 100).toFixed(0)}</div>
                    <div className="w-32 h-2 bg-light-hover dark:bg-dark-hover rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', toNum(trade.ai_score) >= 0.7 ? 'bg-profit' : toNum(trade.ai_score) >= 0.4 ? 'bg-yellow-500' : 'bg-loss')}
                        style={{ width: `${toNum(trade.ai_score) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Media (Screenshots) ────────────────────────── */}
        {activeTab === 'media' && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-2">
                  <Image size={13} /> Screenshots ({screenshots.length})
                </h3>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5"
                >
                  <Plus size={12} /> Ajouter
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleScreenshot}
                />
              </div>

              {screenshots.length === 0 ? (
                <div
                  className="border-2 border-dashed border-light-border dark:border-dark-border rounded-xl p-12 text-center cursor-pointer hover:border-accent/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Image size={28} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500 font-mono">Glisse tes charts ici</p>
                  <p className="text-xs text-gray-400 font-mono mt-1">PNG, JPG, WEBP</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {screenshots.map((src, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden bg-light-hover dark:bg-dark-hover">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Chart ${idx + 1}`} className="w-full object-cover max-h-64" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => removeScreenshot(idx)}
                          className="bg-loss text-white rounded-lg px-3 py-1.5 text-xs font-mono flex items-center gap-1.5"
                        >
                          <Trash2 size={11} /> Supprimer
                        </button>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                        Chart {idx + 1}
                      </div>
                    </div>
                  ))}
                  <div
                    className="border-2 border-dashed border-light-border dark:border-dark-border rounded-xl flex items-center justify-center min-h-32 cursor-pointer hover:border-accent/50 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    <div className="text-center">
                      <Plus size={20} className="mx-auto mb-1 text-gray-400" />
                      <span className="text-xs text-gray-400 font-mono">Ajouter</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {screenshots.length > 0 && dirty && (
              <p className="text-xs text-gray-500 font-mono text-center">
                ⚠️ Les screenshots sont stockés localement — pense à sauvegarder
              </p>
            )}
          </div>
        )}

        {/* ── Sticky save bar (mobile) ─────────────────────────── */}
        {dirty && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-8 py-3 shadow-xl flex items-center gap-2 rounded-full"
            >
              {saving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Check size={15} />
              }
              Sauvegarder les modifications
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
