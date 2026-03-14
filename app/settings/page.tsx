'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import {
  Check, Zap, Lock, Bell, User, Pencil, X,
  Eye, EyeOff, KeyRound, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import TwoFactorSection from '@/components/TwoFactorSection'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://tradelog-api.creasity.com/api/v1'

// ── Constants ─────────────────────────────────────────────────────────────

const PLAN_INFO = {
  free: { label: 'FREE', color: 'text-gray-500 dark:text-gray-400', accounts: 1,        trades: '50/mois',  price: null },
  pro:  { label: 'PRO',  color: 'text-accent',                       accounts: 5,        trades: 'Illimité', price: '29€/mois' },
  algo: { label: 'ALGO', color: 'text-profit',                       accounts: Infinity, trades: 'Illimité', price: '99€/mois' },
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display font-700 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
      {children}
    </h3>
  )
}

function ComingSoonBadge() {
  return (
    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full">
      Bientôt
    </span>
  )
}

function Flash({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={cn(
      'flex items-center gap-2 text-xs font-mono px-4 py-3 rounded-xl border',
      type === 'success'
        ? 'bg-profit/10 border-profit/30 text-profit'
        : 'bg-loss/10 border-loss/30 text-loss'
    )}>
      {type === 'success' ? <Check size={13} /> : <AlertTriangle size={13} />}
      {msg}
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort']
  const colors = ['', 'bg-loss', 'bg-yellow-400', 'bg-accent', 'bg-profit']

  if (!password) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-all',
            i <= score ? colors[score] : 'bg-white/10')} />
        ))}
      </div>
      <p className={cn('text-[10px] font-mono', score <= 1 ? 'text-loss' : score === 2 ? 'text-yellow-400' : score === 3 ? 'text-accent' : 'text-profit')}>
        {labels[score]}
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const plan = user ? PLAN_INFO[user.plan as keyof typeof PLAN_INFO] ?? PLAN_INFO.free : PLAN_INFO.free

  // ── Profile edit state ────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false)
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName,  setLastName]  = useState(user?.last_name  || '')
  const [email,     setEmail]     = useState(user?.email      || '')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: 'success'|'error' } | null>(null)

  const startEditProfile = () => {
    setFirstName(user?.first_name || '')
    setLastName(user?.last_name   || '')
    setEmail(user?.email          || '')
    setProfileMsg(null)
    setEditingProfile(true)
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileMsg(null)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await refreshUser()
      setProfileMsg({ text: 'Profil mis à jour avec succès', type: 'success' })
      setTimeout(() => { setEditingProfile(false); setProfileMsg(null) }, 1500)
    } catch (err: any) {
      setProfileMsg({ text: err.message, type: 'error' })
    } finally {
      setProfileLoading(false)
    }
  }

  // ── Password change state ─────────────────────────────────────────────
  const [editingPwd, setEditingPwd]     = useState(false)
  const [currentPwd, setCurrentPwd]     = useState('')
  const [newPwd,     setNewPwd]         = useState('')
  const [confirmPwd, setConfirmPwd]     = useState('')
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd,     setShowNewPwd]     = useState(false)
  const [pwdLoading, setPwdLoading]     = useState(false)
  const [pwdMsg, setPwdMsg]             = useState<{ text: string; type: 'success'|'error' } | null>(null)

  const resetPwdForm = () => {
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    setShowCurrentPwd(false); setShowNewPwd(false)
    setPwdMsg(null); setEditingPwd(false)
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd !== confirmPwd)
      return setPwdMsg({ text: 'Les mots de passe ne correspondent pas', type: 'error' })
    setPwdLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPwdMsg({ text: 'Mot de passe modifié. Reconnecte-toi sur tes autres appareils.', type: 'success' })
      setTimeout(() => resetPwdForm(), 2500)
    } catch (err: any) {
      setPwdMsg({ text: err.message, type: 'error' })
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <AppLayout title="Paramètres" subtitle="Profil, abonnement & sécurité">
      <div className="max-w-2xl space-y-4">

        {/* ── Profil ───────────────────────────────────────────── */}
        {user && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User size={13} className="text-accent" />
                <SectionTitle>Mon Profil</SectionTitle>
              </div>
              {!editingProfile && (
                <button onClick={startEditProfile}
                  className="flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-accent transition-colors">
                  <Pencil size={11} />Modifier
                </button>
              )}
            </div>

            {!editingProfile ? (
              /* ── Read mode ── */
              <div className="space-y-2 text-sm font-mono">
                {[
                  { label: 'Email',  value: user.email },
                  { label: 'Prénom', value: user.first_name || <span className="text-gray-500 italic text-xs">Non renseigné</span> },
                  { label: 'Nom',    value: user.last_name  || <span className="text-gray-500 italic text-xs">Non renseigné</span> },
                  { label: 'Plan',   value: <span className={plan.color}>{plan.label}</span> },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-light-border dark:border-dark-border last:border-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-gray-800 dark:text-gray-200">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Edit mode ── */
              <form onSubmit={saveProfile} className="space-y-3">
                {profileMsg && <Flash msg={profileMsg.text} type={profileMsg.type} />}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="tl-label">Prénom</label>
                    <input className="tl-input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Prénom" />
                  </div>
                  <div>
                    <label className="tl-label">Nom</label>
                    <input className="tl-input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Nom" />
                  </div>
                </div>
                <div>
                  <label className="tl-label">Email</label>
                  <input className="tl-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setEditingProfile(false)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-gray-400 border border-light-border dark:border-dark-border hover:border-white/20 transition-colors">
                    <X size={12} />Annuler
                  </button>
                  <button type="submit" disabled={profileLoading}
                    className="btn-primary flex items-center gap-1.5 text-xs">
                    {profileLoading
                      ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Check size={12} />
                    }
                    Enregistrer
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Plan & Quota ─────────────────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={13} className="text-accent" />
            <SectionTitle>Plan & Abonnement</SectionTitle>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <span className={cn('font-mono font-bold text-3xl', plan.color)}>{plan.label}</span>
              <div className="space-y-1 text-xs font-mono">
                <div className="text-gray-500">
                  Comptes: <span className="text-gray-800 dark:text-gray-200 font-semibold">
                    {plan.accounts === Infinity ? '∞' : plan.accounts}
                  </span>
                </div>
                <div className="text-gray-500">
                  Trades: <span className="text-gray-800 dark:text-gray-200 font-semibold">{plan.trades}</span>
                </div>
                {user && (
                  <div className="text-gray-500">
                    Ce mois: <span className="text-gray-800 dark:text-gray-200 font-semibold">
                      {(user as any).trades_this_month || 0} trades
                    </span>
                  </div>
                )}
              </div>
            </div>
            {user?.plan === 'free' && (
              <div className="space-y-2">
                <button className="btn-primary flex items-center gap-2 text-xs w-full justify-center">
                  <Zap size={13} /> Pro — 29€/mois
                </button>
                <button className="btn-secondary flex items-center gap-2 text-xs w-full justify-center">
                  <Zap size={13} /> Algo — 99€/mois
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-light-border dark:border-dark-border">
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(PLAN_INFO) as [string, typeof PLAN_INFO.free][]).map(([key, p]) => (
                <div key={key} className={cn(
                  'rounded-xl p-3 text-center border transition-all',
                  user?.plan === key
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-light-border dark:border-dark-border bg-light-hover/50 dark:bg-dark-hover/50'
                )}>
                  <div className={cn('font-mono font-bold text-sm mb-1', p.color)}>{p.label}</div>
                  <div className="text-[10px] font-mono text-gray-500 space-y-0.5">
                    <div>{p.accounts === Infinity ? '∞' : p.accounts} compte{(p.accounts as number) > 1 ? 's' : ''}</div>
                    <div>{p.trades}</div>
                    {p.price
                      ? <div className="text-accent font-semibold mt-1">{p.price}</div>
                      : <div className="text-gray-400 mt-1">Gratuit</div>
                    }
                  </div>
                  {user?.plan === key && (
                    <div className="mt-2 text-[10px] font-mono text-accent font-semibold">● Actif</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sécurité ─────────────────────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={13} className="text-accent" />
            <SectionTitle>Sécurité</SectionTitle>
          </div>

          {/* Sessions actives */}
          <div className="flex items-center justify-between py-2.5 border-b border-light-border dark:border-dark-border">
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Sessions actives</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">Gérer les appareils connectés</div>
            </div>
            <button className="btn-secondary text-xs flex items-center gap-1.5 opacity-50 cursor-not-allowed" disabled>
              Voir <ComingSoonBadge />
            </button>
          </div>

          {/* Change password */}
          <div className="py-2.5">
            {!editingPwd ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Mot de passe</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">Modifier votre mot de passe de connexion</div>
                </div>
                <button onClick={() => { setPwdMsg(null); setEditingPwd(true) }}
                  className="flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-accent transition-colors">
                  <KeyRound size={12} />Modifier
                </button>
              </div>
            ) : (
              <form onSubmit={savePassword} className="space-y-3 pt-1">
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound size={13} className="text-accent" />
                  <span className="text-sm font-display font-700 uppercase tracking-wider text-gray-900 dark:text-white">
                    Modifier le mot de passe
                  </span>
                  <button type="button" onClick={resetPwdForm} className="ml-auto text-gray-500 hover:text-gray-300 transition-colors">
                    <X size={14} />
                  </button>
                </div>

                {pwdMsg && <Flash msg={pwdMsg.text} type={pwdMsg.type} />}

                {/* Current password */}
                <div>
                  <label className="tl-label">Mot de passe actuel</label>
                  <div className="relative">
                    <input
                      className="tl-input pr-10"
                      type={showCurrentPwd ? 'text' : 'password'}
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300">
                      {showCurrentPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="tl-label">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      className="tl-input pr-10"
                      type={showNewPwd ? 'text' : 'password'}
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300">
                      {showNewPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <PasswordStrength password={newPwd} />
                </div>

                {/* Confirm */}
                <div>
                  <label className="tl-label">Confirmer le nouveau mot de passe</label>
                  <input
                    className={cn('tl-input', confirmPwd && newPwd !== confirmPwd && 'border-loss/50 focus:border-loss')}
                    type="password"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  {confirmPwd && newPwd !== confirmPwd && (
                    <p className="text-[10px] font-mono text-loss mt-1">Les mots de passe ne correspondent pas</p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={resetPwdForm}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono text-gray-400 border border-light-border dark:border-dark-border hover:border-white/20 transition-colors">
                    <X size={12} />Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={pwdLoading || !currentPwd || !newPwd || newPwd !== confirmPwd}
                    className="btn-primary flex items-center gap-1.5 text-xs">
                    {pwdLoading
                      ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <ShieldCheck size={12} />
                    }
                    Changer le mot de passe
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Double authentification ──────────────────────────── */}
        <TwoFactorSection
          totpEnabled={user?.totp_enabled ?? false}
          onStatusChange={() => refreshUser()}
        />

        {/* ── Notifications ────────────────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={13} className="text-accent" />
            <SectionTitle>Notifications</SectionTitle>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Alertes & rappels</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">Résumés quotidiens, alertes de drawdown, rappels de journal</div>
            </div>
            <ComingSoonBadge />
          </div>
        </div>

        {/* ── Zone dangereuse ──────────────────────────────────── */}
        <div className="card p-5 border border-loss/20">
          <SectionTitle>Zone dangereuse</SectionTitle>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Supprimer le compte</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">Suppression définitive de toutes vos données</div>
            </div>
            <button className="text-xs font-mono text-loss hover:underline opacity-50 cursor-not-allowed" disabled>
              Supprimer <ComingSoonBadge />
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
