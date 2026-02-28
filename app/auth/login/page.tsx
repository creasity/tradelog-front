'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/api'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Zap, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const { toggle, isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.login(email, password)
      // window.location force un rechargement complet pour que le contexte Auth soit relu
      window.location.href = '/dashboard' 
    } catch (err: any) {
      setError(err.message || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 grid-lines text-gray-900 dark:text-white pointer-events-none" />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-light-surface dark:hover:bg-dark-surface transition-all"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Card */}
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
          <div className="mb-6">
            <h1 className="font-display font-700 text-xl uppercase tracking-wider text-gray-900 dark:text-white">
              Connexion
            </h1>
            <p className="text-sm text-gray-400 font-body mt-1">
              Accède à ton journal de trading
            </p>
          </div>

          {error && (
            <div className="bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2.5 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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

            <div>
              <label className="tl-label">Mot de passe</label>
              <div className="relative">
                <input
                  className="tl-input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4 font-body">
            Pas de compte ?{' '}
            <Link href="/auth/register" className="text-accent hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>

        <p className="text-center text-[10px] text-gray-400 font-mono mt-4 tracking-widest uppercase">
          TradeLog · Propulsé par Creasity
        </p>
      </div>
    </div>
  )
}
