'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Zap, ArrowLeft, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

export default function ForgotPasswordPage() {
  const { toggle, isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setSent(true)
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
          {sent ? (
            /* ── Confirmation ── */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-profit/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-profit" />
              </div>
              <h2 className="font-display font-700 text-lg uppercase tracking-wider text-gray-900 dark:text-white mb-2">
                Email envoyé !
              </h2>
              <p className="text-sm text-gray-400 font-body leading-relaxed mb-6">
                Si l'adresse <span className="text-gray-300 font-mono">{email}</span> est enregistrée, tu recevras un lien de réinitialisation dans quelques minutes.
              </p>
              <p className="text-xs text-gray-500 font-mono mb-6">
                Vérifie aussi tes spams.
              </p>
              <Link href="/auth/login"
                className="flex items-center justify-center gap-2 text-sm font-mono text-accent hover:underline">
                <ArrowLeft size={14} />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="mb-6">
                <h1 className="font-display font-700 text-xl uppercase tracking-wider text-gray-900 dark:text-white">
                  Mot de passe oublié
                </h1>
                <p className="text-sm text-gray-400 font-body mt-1">
                  Saisis ton email pour recevoir un lien de réinitialisation
                </p>
              </div>

              {error && (
                <div className="bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2.5 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="tl-label">Email</label>
                  <input
                    className="tl-input"
                    type="email"
                    autoComplete="email"
                    placeholder="trader@exemple.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : 'Envoyer le lien'}
                </button>
              </form>

              <div className="flex justify-center mt-4">
                <Link href="/auth/login"
                  className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-accent transition-colors">
                  <ArrowLeft size={12} />
                  Retour à la connexion
                </Link>
              </div>
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
