'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/api'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Zap, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { toggle, isDark } = useTheme()
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('Mot de passe : 8 caractères minimum')
    setLoading(true)
    try {
      await auth.register(form.email, form.password, form.first_name, form.last_name)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 grid-lines text-gray-900 dark:text-white pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <button onClick={toggle} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-light-surface dark:hover:bg-dark-surface transition-all">
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="w-full max-w-sm relative">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <span className="font-display font-800 text-2xl tracking-wider uppercase text-gray-900 dark:text-white">TradeLog</span>
        </div>

        <div className="card p-6">
          <div className="mb-6">
            <h1 className="font-display font-700 text-xl uppercase tracking-wider text-gray-900 dark:text-white">Créer un compte</h1>
            <p className="text-sm text-gray-400 font-body mt-1">Commence à journaliser tes trades</p>
          </div>

          {error && (
            <div className="bg-loss/10 border border-loss/30 text-loss text-xs font-mono px-3 py-2.5 rounded-lg mb-4">{error}</div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="tl-label">Prénom</label>
                <input className="tl-input" placeholder="Jean" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
              </div>
              <div>
                <label className="tl-label">Nom</label>
                <input className="tl-input" placeholder="Dupont" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="tl-label">Email</label>
              <input className="tl-input" type="email" placeholder="trader@exemple.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>

            <div>
              <label className="tl-label">Mot de passe</label>
              <div className="relative">
                <input
                  className="tl-input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="8 caractères minimum"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4 font-body">
            Déjà un compte ?{' '}
            <Link href="/auth/login" className="text-accent hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
