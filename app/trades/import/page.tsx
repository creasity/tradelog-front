'use client'

import { useEffect, useRef, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { trades, accounts, Account } from '@/lib/api'
import { cn, formatPnL, getPnLColor } from '@/lib/utils'
import { Upload, FileText, X, Check, AlertCircle, ChevronDown, ArrowRight } from 'lucide-react'

// Colonnes TradeLog attendues
const TL_FIELDS = [
  { key: 'symbol',      label: 'Symbole',       required: true },
  { key: 'side',        label: 'Direction',      required: true,  hint: 'long/short ou buy/sell' },
  { key: 'entry_price', label: 'Prix entrée',    required: true },
  { key: 'quantity',    label: 'Quantité',       required: true },
  { key: 'entry_time',  label: 'Date entrée',    required: true },
  { key: 'exit_price',  label: 'Prix sortie',    required: false },
  { key: 'exit_time',   label: 'Date sortie',    required: false },
  { key: 'fees',        label: 'Frais',          required: false },
  { key: 'leverage',    label: 'Levier',         required: false },
  { key: 'net_pnl',     label: 'P&L Net',        required: false },
  { key: 'stop_loss',   label: 'Stop Loss',      required: false },
  { key: 'take_profit', label: 'Take Profit',    required: false },
  { key: 'notes',       label: 'Notes',          required: false },
  { key: 'trading_mode',   label: 'Mode trading',    required: false, hint: 'Spot ou Futures' },
  { key: 'trading_style',  label: 'Style trading',   required: false, hint: 'Swing / Scalping...' },
  { key: 'order_type',     label: "Type d'ordre",    required: false, hint: 'Market ou Limit' },
  { key: 'blockchain',     label: 'Blockchain',      required: false },
  { key: 'token_contract', label: 'Contrat / Token', required: false },
  { key: 'vwap',           label: 'VWAP',            required: false },
  { key: 'ignore',         label: '— Ignorer —',     required: false },
]

// Auto-détection des colonnes par nom
function autoDetect(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const rules: [RegExp, string][] = [
    [/symbol|pair|instrument/i,          'symbol'],
    [/side|direction|type|order.?type/i, 'side'],
    [/entry.?price|open.?price|avg.?price|price/i, 'entry_price'],
    [/qty|quantity|size|amount/i,        'quantity'],
    [/entry.?time|open.?time|date.?open|created/i, 'entry_time'],
    [/exit.?price|close.?price/i,        'exit_price'],
    [/exit.?time|close.?time|date.?close/i, 'exit_time'],
    [/fee|commission/i,                  'fees'],
    [/leverage|lev/i,                    'leverage'],
    [/pnl|profit|loss|realized/i,        'net_pnl'],
    [/sl|stop.?loss/i,                   'stop_loss'],
    [/tp|take.?profit/i,                 'take_profit'],
    [/note|comment|remark/i,             'notes'],
    [/trading.?mode|mode.?trading/i,     'trading_mode'],
    [/trading.?style|style.?trading/i,   'trading_style'],
    [/order.?type|type.?ordre/i,         'order_type'],
    [/blockchain|chain|network/i,        'blockchain'],
    [/contract|token.?contract|contrat/i,'token_contract'],
    [/vwap/i,                            'vwap'],
  ]
  headers.forEach(h => {
    const match = rules.find(([regex]) => regex.test(h))
    mapping[h] = match ? match[1] : 'ignore'
  })
  return mapping
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const sep = lines[0].includes(';') ? ';' : ','
  const parse = (line: string) =>
    line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
  const headers = parse(lines[0])
  const rows    = lines.slice(1).map(parse)
  return { headers, rows }
}

function normalizeSide(val: string): 'long' | 'short' {
  const v = val.toLowerCase().trim()
  if (['buy', 'long', 'b', '1'].includes(v)) return 'long'
  return 'short'
}

function normalizeDate(val: string): string {
  if (!val) return new Date().toISOString()
  const d = new Date(val)
  if (!isNaN(d.getTime())) return d.toISOString()
  // Try DD/MM/YYYY
  const parts = val.split(/[\/\-\. ]/)
  if (parts.length >= 3) {
    const attempt = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`)
    if (!isNaN(attempt.getTime())) return attempt.toISOString()
  }
  return new Date().toISOString()
}

interface ParsedTrade {
  symbol: string; side: 'long'|'short'; entry_price: number; quantity: number
  entry_time: string; exit_price?: number; exit_time?: string; fees?: number
  leverage?: number; net_pnl?: number; stop_loss?: number; take_profit?: number
  notes?: string; _row: number; _error?: string
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging,    setDragging]    = useState(false)
  const [fileName,    setFileName]    = useState('')
  const [headers,     setHeaders]     = useState<string[]>([])
  const [rows,        setRows]        = useState<string[][]>([])
  const [mapping,     setMapping]     = useState<Record<string, string>>({})
  const [preview,     setPreview]     = useState<ParsedTrade[]>([])
  const [accountList, setAccountList] = useState<Account[]>([])
  const [accountId,   setAccountId]   = useState('')
  const [step,        setStep]        = useState<1|2|3>(1)
  const [importing,   setImporting]   = useState(false)
  const [result,      setResult]      = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  // Load SheetJS for XLSX support
  useEffect(() => {
    if (!(window as any).XLSX) {
      const script = document.createElement('script')
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'
      document.head.appendChild(script)
    }
  }, [])

  useEffect(() => {
    accounts.list().then(d => {
      setAccountList(d.accounts)
      if (d.accounts.length > 0) setAccountId(d.accounts[0].id)
    })
  }, [])

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      alert('Format non supporté. Utilise CSV, XLSX ou XLS.')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()

    if (ext === 'csv') {
      reader.onload = (e) => {
        const text = e.target?.result as string
        const { headers, rows } = parseCSV(text)
        setHeaders(headers)
        setRows(rows)
        setMapping(autoDetect(headers))
        setStep(2)
      }
      reader.readAsText(file)
    } else {
      // XLSX / XLS — parse via SheetJS
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const XLSX = (window as any).XLSX
          if (!XLSX) { alert('Librairie XLSX non chargée. Réessaie dans un instant.'); return }
          const wb   = XLSX.read(data, { type: 'array', cellDates: true, raw: false })
          const ws   = wb.Sheets[wb.SheetNames[0]]
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
          if (json.length < 2) { alert('Fichier vide ou non reconnu.'); return }
          const headers = json[0].map(h => String(h || '').trim()).filter(Boolean)
          const rows    = json.slice(1)
            .map(row => headers.map((_, i) => String(row[i] ?? '').trim()))
            .filter(row => row.some(cell => cell !== ''))
          setHeaders(headers)
          setRows(rows)
          setMapping(autoDetect(headers))
          setStep(2)
        } catch (err: any) {
          alert('Erreur lecture XLSX : ' + err.message)
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // Rebuild preview when mapping changes
  useEffect(() => {
    if (!headers.length || !rows.length) return
    const rev: Record<string, number> = {}
    headers.forEach((h, i) => { if (mapping[h] && mapping[h] !== 'ignore') rev[mapping[h]] = i })

    const parsed: ParsedTrade[] = rows.slice(0, 50).map((row, idx) => {
      const get = (key: string) => rev[key] !== undefined ? (row[rev[key]] || '').trim() : ''
      const t: ParsedTrade = {
        symbol:      get('symbol').toUpperCase(),
        side:        normalizeSide(get('side') || 'long'),
        entry_price: parseFloat(get('entry_price')) || 0,
        quantity:    parseFloat(get('quantity'))    || 0,
        entry_time:  normalizeDate(get('entry_time')),
        _row: idx + 2,
      }
      if (get('exit_price'))  t.exit_price  = parseFloat(get('exit_price'))
      if (get('exit_time'))   t.exit_time   = normalizeDate(get('exit_time'))
      if (get('fees'))        t.fees        = parseFloat(get('fees'))        || 0
      if (get('leverage'))    t.leverage    = parseFloat(get('leverage'))    || 1
      if (get('net_pnl'))     t.net_pnl     = parseFloat(get('net_pnl'))
      if (get('stop_loss'))   t.stop_loss   = parseFloat(get('stop_loss'))
      if (get('take_profit')) t.take_profit = parseFloat(get('take_profit'))
      if (get('notes'))         t.notes          = get('notes')
      if (get('trading_mode'))   (t as any).trading_mode   = get('trading_mode')
      if (get('trading_style'))  (t as any).trading_style  = get('trading_style')
      if (get('order_type'))     (t as any).order_type     = get('order_type')
      if (get('blockchain'))     (t as any).blockchain     = get('blockchain')
      if (get('token_contract')) (t as any).token_contract = get('token_contract')
      if (get('vwap'))           (t as any).vwap           = parseFloat(get('vwap'))

      if (!t.symbol)         t._error = 'Symbole manquant'
      else if (!t.entry_price) t._error = 'Prix entrée invalide'
      else if (!t.quantity)    t._error = 'Quantité invalide'
      return t
    })
    setPreview(parsed)
  }, [mapping, headers, rows])

  const validCount   = preview.filter(t => !t._error).length
  const invalidCount = preview.filter(t =>  t._error).length

  const handleImport = async () => {
    if (!accountId) return alert('Sélectionne un compte')
    setImporting(true)
    const errors: string[] = []
    let imported = 0, skipped = 0

    // Build full list from all rows (not just preview 50)
    const rev: Record<string, number> = {}
    headers.forEach((h, i) => { if (mapping[h] && mapping[h] !== 'ignore') rev[mapping[h]] = i })

    const allTrades = rows.map((row, idx) => {
      const get = (key: string) => rev[key] !== undefined ? (row[rev[key]] || '').trim() : ''
      return {
        account_id:  accountId,
        symbol:      get('symbol').toUpperCase(),
        side:        normalizeSide(get('side') || 'long') as 'long'|'short',
        asset_class: 'crypto' as const,
        entry_price: parseFloat(get('entry_price')),
        quantity:    parseFloat(get('quantity')),
        entry_time:  normalizeDate(get('entry_time')),
        exit_price:  get('exit_price')  ? parseFloat(get('exit_price'))  : undefined,
        exit_time:   get('exit_time')   ? normalizeDate(get('exit_time')) : undefined,
        fees:        get('fees')        ? parseFloat(get('fees'))        : 0,
        leverage:    get('leverage')    ? parseFloat(get('leverage'))    : 1,
        stop_loss:   get('stop_loss')   ? parseFloat(get('stop_loss'))   : undefined,
        take_profit: get('take_profit') ? parseFloat(get('take_profit')) : undefined,
        notes:          get('notes')          || undefined,
        trading_mode:   get('trading_mode')   || undefined,
        trading_style:  get('trading_style')  || undefined,
        order_type:     get('order_type')     || undefined,
        blockchain:     get('blockchain')     || undefined,
        token_contract: get('token_contract') || undefined,
        vwap:           get('vwap') ? parseFloat(get('vwap')) : undefined,
        status:      (get('exit_price') ? 'closed' : 'open') as 'open'|'closed',
        source:      'csv' as const,
        _row: idx + 2,
      }
    }).filter(t => t.symbol && t.entry_price && t.quantity)

    // Import par batch de 20
    const BATCH = 20
    for (let i = 0; i < allTrades.length; i += BATCH) {
      const batch = allTrades.slice(i, i + BATCH)
      try {
        await Promise.all(batch.map(t => {
          const { _row, ...payload } = t
          return trades.create(payload)
        }))
        imported += batch.length
      } catch (err: any) {
        errors.push(`Lignes ${batch[0]._row}–${batch[batch.length-1]._row}: ${err.message}`)
        skipped += batch.length
      }
    }

    setResult({ imported, skipped, errors })
    setStep(3)
    setImporting(false)
  }

  return (
    <AppLayout title="Import CSV / XLSX" subtitle="Importe tes trades depuis un fichier CSV ou Excel">

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { n: 1, label: 'Fichier' },
          { n: 2, label: 'Mapping' },
          { n: 3, label: 'Résultat' },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold',
              step === n ? 'bg-accent text-white' :
              step > n  ? 'bg-profit text-white'  :
              'bg-light-hover dark:bg-dark-hover text-gray-500 dark:text-gray-400'
            )}>
              {step > n ? <Check size={12} /> : n}
            </div>
            <span className={cn('text-xs font-mono uppercase tracking-wide hidden sm:inline',
              step === n ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            )}>{label}</span>
            {i < 2 && <ArrowRight size={12} className="text-gray-400 mx-1" />}
          </div>
        ))}
      </div>

      {/* ── Step 1 : Upload ────────────────────────────────────── */}
      {step === 1 && (
        <div className="max-w-lg mx-auto">
          {/* Account selector */}
          <div className="mb-4">
            <label className="tl-label">Compte de destination</label>
            <select className="tl-select w-full" value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer',
              dragging
                ? 'border-accent bg-accent/5'
                : 'border-light-border dark:border-dark-border hover:border-accent/50 hover:bg-light-hover dark:hover:bg-dark-hover'
            )}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Glisse ton fichier CSV ou Excel ici
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">ou clique pour choisir · CSV, XLSX, XLS</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {/* Tips */}
          <div className="mt-4 card p-4 text-xs font-mono text-gray-500 dark:text-gray-400 space-y-1">
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Formats supportés : CSV, XLSX, XLS — colonnes reconnues auto :</p>
            <p>symbol / pair · side / direction · price / entry_price</p>
            <p>qty / quantity / size · date / entry_time · exit_price</p>
            <p>fee / commission · pnl / profit · leverage · notes</p>
          </div>
        </div>
      )}

      {/* ── Step 2 : Mapping + Preview ─────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-accent" />
                <span className="font-mono text-sm text-gray-700 dark:text-gray-300 font-semibold">{fileName}</span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{rows.length} lignes · {headers.length} colonnes</p>
            </div>
            <button onClick={() => setStep(1)} className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1">
              <X size={12} /> Changer
            </button>
          </div>

          {/* Account selector */}
          <div className="card p-4">
            <label className="tl-label">Compte de destination</label>
            <select className="tl-select w-full sm:w-64" value={accountId} onChange={e => setAccountId(e.target.value)}>
              {accountList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Column mapping */}
          <div className="card p-4 md:p-5">
            <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-900 dark:text-white mb-4">
              Mapping des colonnes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {headers.map(header => (
                <div key={header} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate mb-1" title={header}>
                      {header}
                    </div>
                    <select
                      className="tl-select w-full text-xs"
                      value={mapping[header] || 'ignore'}
                      onChange={e => setMapping(m => ({ ...m, [header]: e.target.value }))}
                    >
                      {TL_FIELDS.map(f => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-light-border dark:border-dark-border">
              <h3 className="font-display font-700 text-sm uppercase tracking-widest text-gray-900 dark:text-white">
                Aperçu (50 premières lignes)
              </h3>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-profit">{validCount} valides</span>
                {invalidCount > 0 && <span className="text-loss">{invalidCount} erreurs</span>}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-light-border dark:divide-dark-border max-h-80 overflow-y-auto">
              {preview.map((t, i) => (
                <div key={i} className={cn('px-4 py-3', t._error && 'bg-loss/5')}>
                  {t._error ? (
                    <div className="flex items-center gap-2 text-xs text-loss font-mono">
                      <AlertCircle size={12} /> Ligne {t._row}: {t._error}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-semibold text-sm text-gray-900 dark:text-white">{t.symbol}</span>
                        <span className={cn('ml-2 badge text-[10px]', t.side === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss')}>
                          {t.side.toUpperCase()}
                        </span>
                      </div>
                      <span className={cn('font-mono text-sm', getPnLColor(t.net_pnl))}>
                        {t.net_pnl !== undefined ? formatPnL(t.net_pnl) : `${t.entry_price}`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto max-h-80 overflow-y-auto">
              <table className="tl-table">
                <thead className="sticky top-0 bg-light-card dark:bg-dark-card">
                  <tr>
                    <th>#</th><th>Symbole</th><th>Direction</th>
                    <th>Prix entrée</th><th>Quantité</th><th>Date</th>
                    <th>P&L</th><th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((t, i) => (
                    <tr key={i} className={t._error ? 'bg-loss/5' : ''}>
                      <td className="text-gray-500 text-xs">{t._row}</td>
                      {t._error ? (
                        <td colSpan={7}>
                          <span className="text-loss text-xs font-mono flex items-center gap-1">
                            <AlertCircle size={11} /> {t._error}
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="font-mono font-semibold">{t.symbol}</td>
                          <td><span className={cn('badge', t.side === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss')}>{t.side.toUpperCase()}</span></td>
                          <td className="font-mono">{t.entry_price}</td>
                          <td className="font-mono">{t.quantity}</td>
                          <td className="font-mono text-xs text-gray-500">{new Date(t.entry_time).toLocaleDateString('fr-FR')}</td>
                          <td className={cn('font-mono', getPnLColor(t.net_pnl))}>{t.net_pnl !== undefined ? formatPnL(t.net_pnl) : '—'}</td>
                          <td><span className="badge bg-gray-500/10 text-gray-500 text-[10px]">{t.exit_price ? 'FERMÉ' : 'OUVERT'}</span></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-mono">
              {rows.length} trades à importer · {rows.filter(r => {
                const rev: Record<string, number> = {}
                headers.forEach((h, i) => { if (mapping[h] && mapping[h] !== 'ignore') rev[mapping[h]] = i })
                const symbol = rev['symbol'] !== undefined ? r[rev['symbol']] : ''
                const price  = rev['entry_price'] !== undefined ? r[rev['entry_price']] : ''
                return symbol && price
              }).length} valides
            </p>
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {importing ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Import en cours...</>
              ) : (
                <><Upload size={14} /> Importer {rows.length} trades</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 : Result ─────────────────────────────────────── */}
      {step === 3 && result && (
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className={cn(
            'card p-8',
            result.imported > 0 ? 'border-profit/30' : 'border-loss/30'
          )}>
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4',
              result.imported > 0 ? 'bg-profit/20' : 'bg-loss/20'
            )}>
              {result.imported > 0
                ? <Check size={24} className="text-profit" />
                : <AlertCircle size={24} className="text-loss" />
              }
            </div>
            <h2 className="font-display font-700 text-xl uppercase tracking-wider text-gray-900 dark:text-white mb-2">
              Import terminé
            </h2>
            <div className="space-y-2 text-sm font-mono">
              <p className="text-profit">{result.imported} trades importés avec succès</p>
              {result.skipped > 0 && <p className="text-loss">{result.skipped} trades ignorés</p>}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4 text-left bg-loss/10 rounded-lg p-3 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-loss font-mono">{e}</p>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep(1); setFileName(''); setHeaders([]); setRows([]); setResult(null) }} className="btn-secondary">
              Nouvel import
            </button>
            <a href="/trades" className="btn-primary">
              Voir mes trades
            </a>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
