'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Zap, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toggle, isDark } = useTheme()

  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) setError('Lien invalide. Refais une demande de réinitialisation.')
  }, [token])

  const strength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8) s++
    if (password.length >= 12) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()

  const strengthLabel = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'][strength]
  const strengthColor = ['', '#ff3b5c', '#ff3b5c', '#f59e0b', '#00d17a', '#00d17a'][strength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-lines pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <button
        onClick={toggle}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-light-surface dark:hover:bg-dark-surface transition-all"
      >
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
          {success ? (
            /* ── Success ── */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-profit/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-profit" />
              </div>
              <h2 className="font-display font-700 text-lg uppercase tracking-wider text-gray-900 dark:text-white mb-2">
                Mot de passe mis à jour !
              </h2>
              <p className="text-sm text-gray-400 font-body leading-relaxed mb-2">
                Ton mot de passe a été réinitialisé avec succès.
              </p>
              <p className="text-xs text-gray-500 font-mono">
                Redirection vers la connexion dans 3 secondes…
              </p>
            </div>
          ) : !token ? (
            /* ── Invalid token ── */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-loss/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} className="text-loss" />
              </div>
              <h2 className="font-display font-700 text-lg uppercase tracking-wider text-gray-900 dark:text-white mb-2">
                Lien invalide
              </h2>
              <p className="text-sm text-gray-400 font-body mb-6">
                Ce lien est invalide ou a expiré.
              </p>
              <Link href="/auth/forgot-password"
                className="btn-primary inline-flex items-center gap-2 text-sm">
                Nouvelle demande
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="mb-6">
                <h1 className="font-display font-700 text-xl uppercase tracking-wider text-gray-900 dark:text-white">
                  Nouveau mot de passe
                </h1>
                <p className="text-sm text-gray-400 font-body mt-1">
                  Choisis un mot de passe sécurisé
                </p>
              </div>

              {error && (
                <div className="bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2.5 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password */}
                <div>
                  <label className="tl-label">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      className="tl-input pr-10"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="8 caractères minimum"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="h-0.5 flex-1 rounded-full transition-all"
                            style={{ background: i <= strength ? strengthColor : '#1e2028' }} />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: strengthColor }}>
                        {strengthLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div>
                  <label className="tl-label">Confirmer le mot de passe</label>
                  <div className="relative">
                    <input
                      className="tl-input pr-10"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300">
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-[10px] font-mono text-loss mt-1">Les mots de passe ne correspondent pas</p>
                  )}
                  {confirm && password === confirm && confirm.length >= 8 && (
                    <p className="text-[10px] font-mono text-profit mt-1">✓ Les mots de passe correspondent</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : 'Réinitialiser le mot de passe'}
                </button>
              </form>
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

import { Suspense } from 'react'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
