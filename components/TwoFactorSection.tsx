'use client'

import { useState } from 'react'
import { ShieldCheck, ShieldOff, Copy, Check, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

interface Props {
  totpEnabled: boolean
  onStatusChange: (enabled: boolean) => void
}

export default function TwoFactorSection({ totpEnabled, onStatusChange }: Props) {
  const [step, setStep]               = useState<'idle' | 'setup' | 'backup' | 'disable'>('idle')
  const [qrCode, setQrCode]           = useState('')
  const [secret, setSecret]           = useState('')
  const [code, setCode]               = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [copied, setCopied]           = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // ── Setup : get QR code ──────────────────────────────────────────
  const startSetup = async () => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${API}/auth/2fa/setup`, { method: 'POST', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQrCode(data.qr_code)
      setSecret(data.secret)
      setStep('setup')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── Verify : activate 2FA ────────────────────────────────────────
  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${API}/auth/2fa/verify`, {
        method: 'POST', headers, body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBackupCodes(data.backup_codes)
      setStep('backup')
      onStatusChange(true)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false); setCode('') }
  }

  // ── Disable ──────────────────────────────────────────────────────
  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${API}/auth/2fa/disable`, {
        method: 'POST', headers, body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep('idle')
      onStatusChange(false)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false); setCode('') }
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => { setStep('idle'); setError(''); setCode(''); setQrCode(''); setSecret('') }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center',
            totpEnabled ? 'bg-profit/10' : 'bg-gray-500/10')}>
            {totpEnabled
              ? <ShieldCheck size={18} className="text-profit" />
              : <ShieldOff size={18} className="text-gray-400" />
            }
          </div>
          <div>
            <h3 className="font-display font-700 text-sm uppercase tracking-wider text-gray-900 dark:text-white">
              Authentification à deux facteurs
            </h3>
            <p className={cn('text-xs font-mono mt-0.5', totpEnabled ? 'text-profit' : 'text-gray-500')}>
              {totpEnabled ? '✓ Activé' : 'Non activé'}
            </p>
          </div>
        </div>
        {step !== 'idle' && step !== 'backup' && (
          <button onClick={reset} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2 rounded-lg mb-4 flex items-center gap-2">
          <AlertTriangle size={12} />{error}
        </div>
      )}

      {/* ── idle ── */}
      {step === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 font-body leading-relaxed">
            {totpEnabled
              ? 'Ton compte est protégé par une application d\'authentification (Google Authenticator, Authy…).'
              : 'Protège ton compte avec une application d\'authentification. Un code temporaire sera demandé à chaque connexion.'
            }
          </p>
          {!totpEnabled ? (
            <button onClick={startSetup} disabled={loading}
              className="btn-primary flex items-center gap-2 text-sm">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ShieldCheck size={14} />}
              Activer le 2FA
            </button>
          ) : (
            <button onClick={() => setStep('disable')}
              className="flex items-center gap-2 text-sm font-mono text-loss hover:bg-loss/10 px-3 py-2 rounded-lg transition-colors">
              <ShieldOff size={14} />Désactiver le 2FA
            </button>
          )}
        </div>
      )}

      {/* ── setup : QR code ── */}
      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400 font-body">
            Scanne ce QR code avec <strong className="text-gray-300">Google Authenticator</strong>, <strong className="text-gray-300">Authy</strong> ou une autre application TOTP.
          </p>

          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR Code 2FA" width={180} height={180} />
            </div>
          </div>

          {/* Manual entry */}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Code manuel</p>
            <p className="text-xs font-mono text-gray-300 break-all tracking-wider">{secret}</p>
          </div>

          {/* Confirm code */}
          <form onSubmit={confirmSetup} className="space-y-3">
            <div>
              <label className="tl-label">Code de vérification</label>
              <input
                className="tl-input text-center text-xl font-mono tracking-[0.4em]"
                type="text" inputMode="numeric" placeholder="000000" maxLength={6}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading || code.length < 6}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirmer et activer'}
            </button>
          </form>
        </div>
      )}

      {/* ── backup codes ── */}
      {step === 'backup' && (
        <div className="space-y-4">
          <div className="bg-profit/10 border border-profit/20 rounded-lg p-3 flex items-start gap-2">
            <ShieldCheck size={14} className="text-profit mt-0.5 flex-shrink-0" />
            <p className="text-xs font-mono text-profit">2FA activé avec succès !</p>
          </div>

          <div>
            <p className="text-sm text-gray-300 font-body font-semibold mb-1">Codes de secours</p>
            <p className="text-xs text-gray-400 font-body mb-3 leading-relaxed">
              Conserve ces codes dans un endroit sûr. Chaque code ne peut être utilisé qu'une seule fois si tu perds accès à ton application.
            </p>
            <div className="bg-dark-surface border border-white/5 rounded-xl p-4 grid grid-cols-2 gap-2">
              {backupCodes.map(c => (
                <code key={c} className="text-xs font-mono text-gray-300 bg-white/5 px-2 py-1 rounded text-center">
                  {c}
                </code>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={copyBackupCodes}
              className="flex items-center gap-2 text-sm font-mono text-gray-400 hover:text-gray-200 hover:bg-white/5 px-3 py-2 rounded-lg transition-all">
              {copied ? <Check size={13} className="text-profit" /> : <Copy size={13} />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
            <button onClick={reset} className="btn-primary text-sm flex-1 text-center">
              Terminé
            </button>
          </div>
        </div>
      )}

      {/* ── disable ── */}
      {step === 'disable' && (
        <div className="space-y-4">
          <div className="bg-loss/10 border border-loss/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-loss mt-0.5 flex-shrink-0" />
            <p className="text-xs font-mono text-loss">La désactivation du 2FA réduit la sécurité de ton compte.</p>
          </div>
          <form onSubmit={confirmDisable} className="space-y-3">
            <div>
              <label className="tl-label">Code TOTP ou code de secours</label>
              <input
                className="tl-input text-center text-xl font-mono tracking-[0.4em]"
                type="text" inputMode="numeric" placeholder="000000" maxLength={9}
                value={code} onChange={e => setCode(e.target.value.replace(/[^0-9A-Fa-f-]/g, '').toUpperCase())}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={reset}
                className="flex-1 py-2 rounded-lg text-sm font-mono text-gray-400 border border-white/10 hover:border-white/20 transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={loading || code.length < 6}
                className="flex-1 py-2 rounded-lg text-sm font-mono text-loss bg-loss/10 hover:bg-loss/20 transition-colors flex items-center justify-center gap-2">
                {loading ? <span className="w-4 h-4 border-2 border-loss border-t-transparent rounded-full animate-spin" /> : 'Désactiver'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
