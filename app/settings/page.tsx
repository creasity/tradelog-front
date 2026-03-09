'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Check, Zap, Lock, Bell, User } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────

const PLAN_INFO = {
  free:  { label: 'FREE',  color: 'text-gray-500 dark:text-gray-400', accounts: 1,        trades: '50/mois',  price: null },
  pro:   { label: 'PRO',   color: 'text-accent',                       accounts: 5,        trades: 'Illimité', price: '29€/mois' },
  algo:  { label: 'ALGO',  color: 'text-profit',                       accounts: Infinity, trades: 'Illimité', price: '99€/mois' },
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

// ── Main page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth()
  const [flash] = useState('')

  const plan = user ? PLAN_INFO[user.plan as keyof typeof PLAN_INFO] ?? PLAN_INFO.free : PLAN_INFO.free

  return (
    <AppLayout title="Paramètres" subtitle="Profil, abonnement & sécurité">
      <div className="max-w-2xl space-y-4">

        {flash && (
          <div className="flex items-center gap-2 bg-profit/10 border border-profit/30 text-profit text-xs font-mono px-4 py-3 rounded-xl">
            <Check size={13} /> {flash}
          </div>
        )}

        {/* ── Profil ───────────────────────────────────────────── */}
        {user && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <User size={13} className="text-accent" />
              <SectionTitle>Mon Profil</SectionTitle>
            </div>
            <div className="space-y-2 text-sm font-mono">
              {[
                { label: 'Email',  value: user.email },
                ...(user.first_name ? [{ label: 'Prénom', value: user.first_name }] : []),
                ...(user.last_name  ? [{ label: 'Nom',    value: user.last_name  }] : []),
                { label: 'Plan',   value: <span className={plan.color}>{plan.label}</span> },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-light-border dark:border-dark-border last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-800 dark:text-gray-200">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button className="btn-secondary text-xs flex items-center gap-2 opacity-50 cursor-not-allowed" disabled>
                Modifier le profil <ComingSoonBadge />
              </button>
            </div>
          </div>
        )}

        {/* ── Plan & Quota ─────────────────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
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

          {/* Plan comparison */}
          <div className="mt-5 pt-4 border-t border-light-border dark:border-dark-border">
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(PLAN_INFO) as [string, typeof PLAN_INFO.free][]).map(([key, p]) => (
                <div
                  key={key}
                  className={cn(
                    'rounded-xl p-3 text-center border transition-all',
                    user?.plan === key
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-light-border dark:border-dark-border bg-light-hover/50 dark:bg-dark-hover/50'
                  )}
                >
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
          <div className="flex items-center gap-2 mb-1">
            <Lock size={13} className="text-accent" />
            <SectionTitle>Sécurité</SectionTitle>
          </div>
          <div className="space-y-1">
            {[
              {
                title: 'Mot de passe',
                desc:  'Modifier votre mot de passe de connexion',
                label: 'Modifier',
              },
              {
                title: 'Double authentification',
                desc:  'Sécurisez votre compte avec un code OTP',
                label: 'Activer',
              },
              {
                title: 'Sessions actives',
                desc:  'Gérer les appareils connectés',
                label: 'Voir',
              },
            ].map(({ title, desc, label }) => (
              <div key={title} className="flex items-center justify-between py-2.5 border-b border-light-border dark:border-dark-border last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{desc}</div>
                </div>
                <button className="btn-secondary text-xs flex items-center gap-1.5 opacity-50 cursor-not-allowed" disabled>
                  {label} <ComingSoonBadge />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Notifications ────────────────────────────────────── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
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
