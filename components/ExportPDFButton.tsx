'use client'

import { useState } from 'react'
import { FileDown, Loader2, X, Calendar, CreditCard, CheckCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

interface Account {
  id: string
  name: string
}

interface Props {
  accounts: Account[]
  activeAccountId?: string
}

export default function ExportPDFButton({ accounts, activeAccountId }: Props) {
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)

  const [accountId, setAccountId] = useState(activeAccountId || '')
  const [dateFrom, setDateFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])

  const handleExport = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const params = new URLSearchParams()
      if (accountId) params.set('account_id', accountId)
      if (dateFrom)  params.set('date_from', dateFrom)
      if (dateTo)    params.set('date_to', dateTo)

      const res = await fetch(`${API}/trades/export/pdf?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) throw new Error('Erreur export')

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `tradelog-export-${dateFrom}-${dateTo}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      setSuccess(true)
      setTimeout(() => { setSuccess(false); setOpen(false) }, 1500)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-400 border border-light-border dark:border-dark-border hover:border-accent/40 hover:text-accent transition-all"
      >
        <FileDown size={13} />
        Export PDF
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-sm bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow-2xl p-6 z-10">

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileDown size={15} className="text-accent" />
                </div>
                <div>
                  <h2 className="font-display font-700 text-sm uppercase tracking-wider text-gray-900 dark:text-white">Export PDF</h2>
                  <p className="text-[10px] font-mono text-gray-500 mt-0.5">Journal de trading</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <X size={16} />
              </button>
            </div>

            {success ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle size={36} className="text-profit" />
                <p className="font-mono text-sm text-profit">PDF téléchargé !</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    <CreditCard size={10} />Compte
                  </label>
                  <select value={accountId} onChange={e => setAccountId(e.target.value)} className="tl-input text-sm">
                    <option value="">Tous les comptes</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    <Calendar size={10} />Période
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-mono text-gray-500 mb-1">Du</p>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="tl-input text-xs" />
                    </div>
                    <div>
                      <p className="text-[9px] font-mono text-gray-500 mb-1">Au</p>
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="tl-input text-xs" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {[{ label: '7j', days: 7 }, { label: '30j', days: 30 }, { label: '90j', days: 90 }, { label: 'YTD', days: 0 }].map(({ label, days }) => (
                    <button key={label} onClick={() => {
                      const to = new Date(), from = new Date()
                      if (days === 0) { from.setMonth(0); from.setDate(1) } else { from.setDate(from.getDate() - days) }
                      setDateFrom(from.toISOString().split('T')[0])
                      setDateTo(to.toISOString().split('T')[0])
                    }} className="px-2.5 py-1 rounded-md text-[10px] font-mono text-gray-400 border border-dark-border hover:border-accent/40 hover:text-accent transition-all">
                      {label}
                    </button>
                  ))}
                </div>

                <button onClick={handleExport} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                  {loading ? <><Loader2 size={14} className="animate-spin" />Génération en cours…</> : <><FileDown size={14} />Télécharger le PDF</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
