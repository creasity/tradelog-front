'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, BarChart3,
  PlusCircle, Settings, LogOut, Zap, Menu, X
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/trades',     icon: TrendingUp,       label: 'Trades' },
  { href: '/trades/new', icon: PlusCircle,       label: 'Nouveau Trade' },
  { href: '/analytics',  icon: BarChart3,        label: 'Analytics' },
  { href: '/settings',   icon: Settings,         label: 'Paramètres' },
]

const PLAN_COLORS: Record<string, string> = {
  free: 'text-gray-500 dark:text-gray-400',
  pro:  'text-accent',
  algo: 'text-profit',
}

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <>
      <div className="px-5 py-5 border-b border-light-border dark:border-dark-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-accent flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <span className="font-display font-700 text-xl tracking-wider uppercase text-gray-900 dark:text-white">
            TradeLog
          </span>
        </div>
        {user && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={cn('text-xs font-mono uppercase tracking-widest font-semibold', PLAN_COLORS[user.plan] || '')}>
              {user.plan}
            </span>
            <span className="text-gray-400 dark:text-gray-600">·</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{user.email}</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href ||
            (href !== '/dashboard' && href !== '/trades/new' && pathname.startsWith(href))
          const isNew = href === '/trades/new'
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body font-medium transition-all group',
                isNew
                  ? 'bg-accent/10 text-accent hover:bg-accent/20 mt-2'
                  : active
                  ? 'bg-light-hover dark:bg-dark-hover text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-light-hover dark:hover:bg-dark-hover'
              )}
            >
              <Icon size={16} className={cn(
                'flex-shrink-0',
                isNew ? 'text-accent'
                  : active ? 'text-accent'
                  : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
              )} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-5 border-t border-light-border dark:border-dark-border pt-3">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-loss hover:bg-loss/10 transition-all w-full"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col bg-light-surface dark:bg-dark-surface border-r border-light-border dark:border-dark-border z-50">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
            <Zap size={12} className="text-white" fill="white" />
          </div>
          <span className="font-display font-700 text-lg tracking-wider uppercase text-gray-900 dark:text-white">
            TradeLog
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-400 hover:bg-light-hover dark:hover:bg-dark-hover"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={cn(
        'md:hidden fixed top-0 left-0 h-screen w-64 z-50 flex flex-col bg-light-surface dark:bg-dark-surface border-r border-light-border dark:border-dark-border transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-light-hover dark:hover:bg-dark-hover"
        >
          <X size={16} />
        </button>
        <NavContent onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
