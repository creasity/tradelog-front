'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/api'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Zap, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

export default function LoginPage() {
  const router = useRouter()
  const { toggle, isDark } = useTheme()

  // Step 1 : credentials
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Step 2 : TOTP
  const [totpRequired, setTotpRequired] = useState(false)
  const [pendingToken, setPendingToken] = useState('')
  const [totpCode, setTotpCode]         = useState('')

  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (auth.isAuthenticated()) window.location.href = '/dashboard'
    else setChecking(false)
  }, [])

  // ── Step 1 : Email + password ─────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await auth.login(email, password)
      if ((data as any).totp_required) {
        setPendingToken((data as any).pending_token)
        setTotpRequired(true)
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 : TOTP code ────────────────────────────────────────────
  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/2fa/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_token: pendingToken, code: totpCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Code incorrect')
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.message)
      setTotpCode('')
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (totpCode.replace(/\s/g, '').length === 6 && totpRequired) {
      handleTotp({ preventDefault: () => {} } as any)
    }
  }, [totpCode])

  if (checking) return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-lines pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <button onClick={toggle}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-light-surface dark:hover:bg-dark-surface transition-all">
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <span className="font-display font-800 text-2xl tracking-wider uppercase text-gray-900 dark:text-white">
            TradeLog
          </span>
        </div>

        <div className="card p-6">

          {!totpRequired ? (
            /* ── Step 1 : credentials ── */
            <>
              <div className="mb-6">
                <h1 className="font-display font-700 text-xl uppercase tracking-wider text-gray-900 dark:text-white">Connexion</h1>
                <p className="text-sm text-gray-400 font-body mt-1">Accède à ton journal de trading</p>
              </div>

              {error && (
                <div className="bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2.5 rounded-lg mb-4">{error}</div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="tl-label">Email</label>
                  <input className="tl-input" type="email" autoComplete="email" placeholder="trader@exemple.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="tl-label mb-0">Mot de passe</label>
                    <Link href="/auth/forgot-password" className="text-[11px] font-mono text-accent hover:underline">
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <div className="relative">
                    <input className="tl-input pr-10" type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password" placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                  {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Se connecter'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 mt-4 font-body">
                Pas de compte ?{' '}
                <Link href="/auth/register" className="text-accent hover:underline">Créer un compte</Link>
              </p>
            </>
          ) : (
            /* ── Step 2 : TOTP ── */
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={20} className="text-accent" />
                </div>
                <div>
                  <h1 className="font-display font-700 text-lg uppercase tracking-wider text-gray-900 dark:text-white">
                    Vérification 2FA
                  </h1>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{email}</p>
                </div>
              </div>

              {error && (
                <div className="bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2.5 rounded-lg mb-4">{error}</div>
              )}

              <p className="text-sm text-gray-400 font-body mb-4">
                Saisis le code à 6 chiffres de ton application d'authentification.
              </p>

              <form onSubmit={handleTotp} className="space-y-4">
                <div>
                  <label className="tl-label">Code d'authentification</label>
                  <input
                    className="tl-input text-center text-2xl font-mono tracking-[0.5em] h-14"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading || totpCode.length < 6}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirmer'}
                </button>
              </form>

              <button onClick={() => { setTotpRequired(false); setError(''); setTotpCode('') }}
                className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-accent transition-colors mx-auto mt-4">
                <ArrowLeft size={12} />Utiliser un autre compte
              </button>

              <p className="text-center text-xs text-gray-500 font-mono mt-3">
                Code de secours ?{' '}
                <span className="text-gray-400">Saisis-le à la place du code</span>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-400 font-mono mt-4 tracking-widest uppercase">
          TradeLog · Propulsé par Creasity
        </p>
      </div>
    </div>
  )
}
